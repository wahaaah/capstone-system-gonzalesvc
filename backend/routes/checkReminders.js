const db = require('../config/db.js');

async function checkReminders() {
    try {
        console.log('🔔 Checking appointment reminders...');

        const [appointments] = await db.query(`
    SELECT
        a.appointment_id,
        a.patient_id,
        DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
        a.appointment_time,
        a.appointment_status
    FROM appointments a
    WHERE
        LOWER(a.appointment_status) = 'approved'
        AND TIMESTAMP(a.appointment_date, a.appointment_time)
            BETWEEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
            AND DATE_ADD(
                DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR),
                INTERVAL 24 HOUR
            )
`);

        let created = 0;

        for (const appointment of appointments) {

            // Prevent duplicate reminders
            const [existing] = await db.query(
                `SELECT notification_id
                 FROM notifications
                 WHERE appointment_id = ?
                   AND type = 'appointment_reminder'
                 LIMIT 1`,
                [appointment.appointment_id]
            );

            if (existing.length > 0) {
                continue;
            }

           // Format date directly without JavaScript Date conversion
const dateString = String(appointment.appointment_date).slice(0, 10);

const [year, month, day] = dateString.split('-');

const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

const formattedDate =
    `${monthNames[Number(month) - 1]} ${Number(day)}, ${year}`;

            // Format time
            const timeParts = String(
                appointment.appointment_time
            ).slice(0, 8).split(':');

            let hours = Number(timeParts[0]);
            const minutes = timeParts[1];

            const period = hours >= 12 ? 'PM' : 'AM';

            hours = hours % 12 || 12;

            const formattedTime =
                `${hours}:${minutes} ${period}`;

        await db.query(
    `INSERT INTO notifications
        (patient_id, appointment_id, type, title, body)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE notification_id = notification_id`,
    [
        appointment.patient_id,
        appointment.appointment_id,
        'appointment_reminder',
        'Appointment Reminder',
        `Your appointment is scheduled for ${formattedDate} at ${formattedTime}.`
    ]
);

            console.log(
                `🔔 Reminder created for appointment #${appointment.appointment_id}`
            );

            created++;
        }

        console.log(
            `✅ Reminder check complete. Found: ${appointments.length}, Created: ${created}`
        );

   } catch (error) {
    console.error('❌ Reminder check failed:', {
        name: error.name,
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        stack: error.stack
    });

    process.exitCode = 1;
} finally {
    await db.end();
}
}

checkReminders();