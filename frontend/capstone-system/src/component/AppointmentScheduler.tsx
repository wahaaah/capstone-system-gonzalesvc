import React, { useState, useEffect, useMemo } from 'react';
import { appointmentService, type Appointment } from '../services/appointmentService';
import { patientService, type Patient } from '../services/patientService';
import { Bell, Check, X, ShieldAlert, Pencil, Ban, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react';

interface AppointmentSchedulerProps {
  preSelectedId?: string;
  clearPreSelected?: () => void;
  onNavigate: (viewId: string, patientId: string) => void;
}

export default function AppointmentScheduler({ preSelectedId, clearPreSelected, onNavigate }: AppointmentSchedulerProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Patient Lookup State for Form
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Get local YYYY-MM-DD for today to restrict past dates
  const todayString = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [selectedViewDate, setSelectedViewDate] = useState(todayString);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [incomingRequests, setIncomingRequests] = useState<Appointment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [formPatientId, setFormPatientId] = useState('');
  const [formDate, setFormDate] = useState(todayString);
  const [formTime, setFormTime] = useState('');
  const [formPurpose, setFormPurpose] = useState('');

  // Helper map using the single 'name' and 'patient_id' fields from patientService
  const patientMap = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach(p => {
      const pid = p.patient_id;
      if (pid) {
        map.set(pid, p.name || 'Unnamed Patient');
      }
    });
    return map;
  }, [patients]);

  useEffect(() => {
    loadSchedule();
    loadPatients();
    const interval = setInterval(loadSchedule, 60000); 
    return () => clearInterval(interval);
  }, []);

  const loadPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const data = await patientService.getAll();
      setPatients(data);
    } catch (err: any) {
      console.error('Failed to load patients:', err.message);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  useEffect(() => {
    if (preSelectedId && patients.length > 0) {
      setFormPatientId(preSelectedId);
      const matched = patients.find(p => p.patient_id === preSelectedId);
      if (matched) {
        setSelectedPatient(matched);
        const displayName = patientMap.get(preSelectedId) || matched.name || preSelectedId;
        setPatientSearchQuery(`${displayName} (${preSelectedId})`);
      } else {
        setPatientSearchQuery(preSelectedId);
      }
      if (clearPreSelected) clearPreSelected();
    }
  }, [preSelectedId, patients, patientMap, clearPreSelected]);

  const standardTimeSlots = [
    { raw: "08:00:00", display: "08:00 AM" }, { raw: "08:30:00", display: "08:30 AM" },
    { raw: "09:00:00", display: "09:00 AM" }, { raw: "09:30:00", display: "09:30 AM" },
    { raw: "10:00:00", display: "10:00 AM" }, { raw: "10:30:00", display: "10:30 AM" },
    { raw: "11:00:00", display: "11:00 AM" }, { raw: "11:30:00", display: "11:30 AM" },
    { raw: "12:00:00", display: "12:00 PM" }, { raw: "12:30:00", display: "12:30 PM" },
    { raw: "13:00:00", display: "01:00 PM" }, { raw: "13:30:00", display: "01:30 PM" },
    { raw: "14:00:00", display: "02:00 PM" }, { raw: "14:30:00", display: "02:30 PM" },
    { raw: "15:00:00", display: "03:00 PM" }, { raw: "15:30:00", display: "03:30 PM" },
    { raw: "16:00:00", display: "04:00 PM" }, { raw: "16:30:00", display: "04:30 PM" },
    { raw: "17:00:00", display: "05:00 PM" }, { raw: "17:30:00", display: "05:30 PM" },
  ];

  // Helper function to check if a specific time slot has already passed today in real-time
  const isSlotInPast = (dateStr: string, timeRaw: string) => {
    if (dateStr !== todayString) return false;
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    const [slotHours, slotMinutes] = timeRaw.split(':').map(Number);

    if (slotHours < currentHours) return true;
    if (slotHours === currentHours && slotMinutes <= currentMinutes) return true;
    return false;
  };

  const takenSlots = useMemo(() => {
    return appointments
      .filter(a => a.appointment_status !== 'Cancelled' && a.appointment_status !== 'Requested')
      .map(a => ({
        date: a.appointment_date?.split('T')[0],
        time: a.appointment_time?.substring(0, 5)
      }));
  }, [appointments]);

  const loadSchedule = async () => {
    try {
      const data = await appointmentService.getAll();
      const approved = data.filter((a: Appointment) => a.appointment_status !== 'Requested');
      const mobileReqs = data.filter((a: Appointment) => a.appointment_status === 'Requested');
      
      setAppointments(approved);
      setIncomingRequests(mobileReqs);
    } catch (err: any) {
      console.error('Failed to load schedule:', err.message);
    }
  };

  const handleAcceptRequest = async (appointment: Appointment) => {
  try {
    const targetTime = appointment.appointment_time?.substring(0, 5);
    const targetDate = appointment.appointment_date?.split('T')[0];

    if (targetDate && targetDate < todayString) {
      alert("Cannot accept request: The requested date is in the past.");
      return;
    }

    if (
      targetDate &&
      targetDate === todayString &&
      targetTime &&
      isSlotInPast(targetDate, targetTime + ':00')
    ) {
      alert("Cannot accept request: The requested time slot has already passed today.");
      return;
    }

    const isAlreadyOccupied = appointments.some(
      a =>
        a.appointment_date?.split('T')[0] === targetDate &&
        a.appointment_time?.substring(0, 5) === targetTime &&
        a.appointment_status !== 'Cancelled'
    );

    if (isAlreadyOccupied) {
      alert(
        "Cannot accept request: This slot has already been booked manually in the interim."
      );
      return;
    }

    const targetId = appointment.id || appointment.appointment_id;

    if (!targetId) {
      alert("Error: Cannot process request. Missing Appointment ID.");
      return;
    }

    if (appointmentService.update) {
      await appointmentService.update(targetId, {
        ...appointment,
        appointment_status: 'Confirmed'
      });
    } else {
      await appointmentService.create({
        ...appointment,
        appointment_status: 'Confirmed'
      });
    }

    await loadSchedule();

  } catch (err: any) {
    alert(`Error updating request: ${err.message}`);
  }
};

  const handleCancelRequest = async (appointment: Appointment) => {
  const targetId = appointment.id || appointment.appointment_id;

  if (!targetId) {
    alert('Error: Cannot cancel request. Missing Appointment ID.');
    return;
  }

  if (
    !window.confirm(
      'Cancel this mobile appointment request? The patient request will be removed from the request queue.'
    )
  ) {
    return;
  }

  try {
    await appointmentService.updateStatus(targetId, 'Cancelled');

    await loadSchedule();

    alert('Mobile appointment request cancelled successfully.');
  } catch (err: any) {
    alert(`Error cancelling request: ${err.message}`);
  }
};


  // Filter patients using single 'name' and 'patient_id' properties
  const filteredPatientOptions = patients.filter(p => {
    const pid = p.patient_id || '';
    const patientName = p.name || '';
    return (
      patientName.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
      pid.toLowerCase().includes(patientSearchQuery.toLowerCase())
    );
  });

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    const pid = patient.patient_id;
    const displayName = patient.name || pid;
    setFormPatientId(pid);
    setPatientSearchQuery(`${displayName} (${pid})`);
    setIsPatientDropdownOpen(false);
  };

  const handleWalkIn = () => {
    const walkInId = `WI-${Date.now().toString().slice(-4)}`;
    setFormPatientId(walkInId);
    setPatientSearchQuery(`Walk-In Patient (${walkInId})`);
    setFormDate(todayString);
    setSelectedViewDate(todayString);
    setFormPurpose('Walk-in Consultation');
    setSelectedPatient(null);
  };

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formPatientId || !formDate || !formTime || !formPurpose) {
      setErrorMessage('Please fill out all operational fields.');
      return;
    }

    if (formDate < todayString) {
      setErrorMessage('Cannot book appointments on past dates.');
      return;
    }

    if (formDate === todayString && isSlotInPast(formDate, formTime)) {
      setErrorMessage('Cannot book a time slot that has already passed today.');
      return;
    }

    try {
      await appointmentService.create({
        patient_id: formPatientId,
        appointment_date: formDate,
        appointment_time: formTime,
        purpose_of_visit: formPurpose,
        appointment_status: 'Pending'
      });
      setSuccessMessage('Reservation confirmed!');
      setSelectedViewDate(formDate);
      setFormPatientId(''); 
      setPatientSearchQuery('');
      setSelectedPatient(null);
      setFormDate(todayString); 
      setFormTime(''); 
      setFormPurpose('');
      loadSchedule();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const openEditModal = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditDate(appointment.appointment_date?.split('T')[0] || todayString);
    setEditTime(appointment.appointment_time?.substring(0, 5) + ':00' || '');
    setEditPurpose(appointment.purpose_of_visit || '');
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingAppointment(null);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppointment) return;
    setEditError('');

    if (editDate < todayString) {
      setEditError('Cannot schedule appointments in the past.');
      return;
    }

    if (editDate === todayString && isSlotInPast(editDate, editTime)) {
      setEditError('Cannot schedule a time slot that has already passed today.');
      return;
    }

    const targetId = editingAppointment.appointment_id || editingAppointment.id;
    if (!targetId) {
      setEditError('Missing appointment ID — cannot save.');
      return;
    }

    setIsSavingEdit(true);
    try {
      await appointmentService.update(targetId, {
        ...editingAppointment,
        appointment_date: editDate,
        appointment_time: editTime,
        purpose_of_visit: editPurpose,
      });
      closeEditModal();
      loadSchedule();
    } catch (err: any) {
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!editingAppointment) return;
    const targetId = editingAppointment.appointment_id || editingAppointment.id;
    if (!targetId) return;

    if (!window.confirm('Cancel this appointment? The slot will become available again.')) return;

    try {
      await appointmentService.updateStatus(targetId, 'Cancelled');
      closeEditModal();
      loadSchedule();
    } catch (err: any) {
      setEditError(err.message || 'Failed to cancel appointment.');
    }
  };

  const getDaysInMonth = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ dayNumber: i, dateString });
    }
    return days;
  };

  const changeMonth = (offset: number) => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1));
  };

  const calendarDays = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      
      {/* Schedule Calendar View */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* TOP PANEL: Interactive Calendar Grid */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Select Date</h3>
            <div className="flex items-center space-x-4">
              <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={18}/></button>
              <span className="text-sm font-semibold text-slate-700 w-32 text-center">
                {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={18}/></button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2 text-center">
            {calendarDays.map((dayObj, index) => {
              if (!dayObj) return <div key={`empty-${index}`} className="p-2" />;
              
              const isPast = dayObj.dateString < todayString;
              const isSelected = dayObj.dateString === selectedViewDate;
              const hasBookings = takenSlots.some(s => s.date === dayObj.dateString);
              
              return (
                <button
                  key={dayObj.dateString}
                  onClick={() => !isPast && setSelectedViewDate(dayObj.dateString)}
                  disabled={isPast}
                  className={`relative p-2 text-sm rounded-lg transition-all ${
                    isPast ? 'text-slate-300 bg-slate-50 cursor-not-allowed opacity-60' :
                    isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : 
                    'hover:bg-slate-100 text-slate-700 font-medium'
                  }`}
                >
                  {dayObj.dayNumber}
                  {hasBookings && !isSelected && !isPast && (
                    <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full"></span>
                  )}
                  {hasBookings && isSelected && (
                    <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full opacity-80"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM PANEL: The Agendas & Time Slots for the Selected Date */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-6 gap-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Agenda for {new Date(selectedViewDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95 ${
                incomingRequests.length > 0 
                  ? 'bg-rose-100 text-rose-600 animate-pulse' 
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Bell size={14} />
              <span>{incomingRequests.length} App Requests</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {standardTimeSlots.map((slot) => {
              const isBooked = takenSlots.some(s => s.date === selectedViewDate && s.time === slot.raw.substring(0, 5));
              const isPastTime = isSlotInPast(selectedViewDate, slot.raw);
              const booking = appointments.find(a => 
                a.appointment_date?.split('T')[0] === selectedViewDate && 
                a.appointment_time?.substring(0, 5) === slot.raw.substring(0, 5) && 
                a.appointment_status !== 'Cancelled'
              );
              
              return (
                <div key={slot.raw} className={`p-3 rounded-xl border flex items-center justify-between ${isBooked || isPastTime ? 'bg-amber-50/60 border-amber-200/60' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${isBooked || isPastTime ? 'bg-amber-100 text-amber-800' : 'bg-white border text-slate-600'}`}>
                      {slot.display}
                    </span>
                    
                    {booking ? (
                      <div>
                        <button
  onClick={() => onNavigate('patient-info', String(booking.patient_id))}
  className="text-xs font-bold text-blue-600 hover:underline"
>
  {patientMap.get(String(booking.patient_id)) || booking.patient_id}
</button>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{booking.purpose_of_visit}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{isPastTime ? 'Unavailable' : 'Available'}</span>
                    )}
                  </div>
                  {booking ? (
                    <button
                      onClick={() => openEditModal(booking)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit appointment"
                    >
                      <Pencil size={14} />
                    </button>
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${isBooked || isPastTime ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Booking Form Side Panel */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit sticky top-6">
        <button type="button" onClick={handleWalkIn} className="mb-4 w-full text-xs font-bold text-blue-600 bg-blue-50 py-2 rounded-lg hover:bg-blue-100 transition-colors">
          + Register Walk-In Patient
        </button>
        <h3 className="text-lg font-bold text-slate-800 mb-4">Book Clinical Slot</h3>
        <form onSubmit={handleBookSlot} className="space-y-4">
           {errorMessage && <div className="text-xs bg-red-50 text-red-600 p-2.5 rounded-lg border border-red-100">{errorMessage}</div>}
           {successMessage && <div className="text-xs bg-emerald-50 text-emerald-600 p-2.5 rounded-lg border border-emerald-100">{successMessage}</div>}

           {/* Live Patient Search & Typeahead Box */}
           <div className="relative">
             <label className="block text-xs font-medium text-slate-500 mb-1">Patient Search (Name or ID)</label>
             <div className="relative">
               <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                 <Search size={14} />
               </span>
               <input 
                 type="text" 
                 placeholder="Search patient name or ID..." 
                 value={patientSearchQuery} 
                 onChange={(e) => {
                   setPatientSearchQuery(e.target.value);
                   setIsPatientDropdownOpen(true);
                   if (!e.target.value) {
                     setSelectedPatient(null);
                     setFormPatientId('');
                   }
                 }} 
                 onFocus={() => setIsPatientDropdownOpen(true)}
                 className="w-full text-sm pl-9 pr-8 border rounded-lg p-2 bg-white" 
               />
               {patientSearchQuery && (
                 <button
                   type="button"
                   onClick={() => {
                     setPatientSearchQuery('');
                     setFormPatientId('');
                     setSelectedPatient(null);
                   }}
                   className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                 >
                   ✕
                 </button>
               )}
             </div>

             {/* Live Dropdown Box */}
             {isPatientDropdownOpen && patientSearchQuery && !selectedPatient && (
               <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                 {isLoadingPatients ? (
                   <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                     <Loader2 size={14} className="animate-spin text-blue-600" />
                     <span>Loading database...</span>
                   </div>
                 ) : filteredPatientOptions.length > 0 ? (
                   filteredPatientOptions.map((patient) => {
                     const pid = patient.patient_id;
                     const displayName = patient.name || 'Unnamed';
                     return (
                       <div
                         key={pid}
                         onClick={() => handleSelectPatient(patient)}
                         className="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none flex justify-between items-center text-xs"
                       >
                         <div>
                           <p className="font-semibold text-slate-900">{displayName}</p>
                           <p className="text-[10px] text-slate-400">ID: {pid}</p>
                         </div>
                         <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">Select</span>
                       </div>
                     );
                   })
                 ) : (
                   <div className="p-3 text-center text-xs text-slate-400">
                     No matching patient records found.
                   </div>
                 )}
               </div>
             )}
           </div>

           <div>
             <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
             <input type="date" min={todayString} value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full text-sm border rounded-lg p-2" />
           </div>

           <div>
             <label className="block text-xs font-medium text-slate-500 mb-1">Time Slot</label>
             <select value={formTime} onChange={(e) => setFormTime(e.target.value)} className="w-full text-sm border rounded-lg p-2 bg-white">
               <option value="">Select a time</option>
               {standardTimeSlots.map(slot => {
                 const isTaken = takenSlots.some(s => s.date === formDate && s.time === slot.raw.substring(0, 5));
                 const isPastTime = isSlotInPast(formDate, slot.raw);
                 const isDisabled = isTaken || isPastTime;

                 return (
                   <option key={slot.raw} value={slot.raw} disabled={isDisabled}>
                     {slot.display} {isTaken ? '(Reserved)' : isPastTime ? '(Unavailable)' : ''}
                   </option>
                 );
               })}
             </select>
           </div>

           <div>
             <label className="block text-xs font-medium text-slate-500 mb-1">Purpose of Visit</label>
             <input type="text" placeholder="Purpose" value={formPurpose} onChange={(e) => setFormPurpose(e.target.value)} className="w-full text-sm border rounded-lg p-2" />
           </div>

           <button type="submit" className="w-full bg-blue-600 text-white rounded-lg p-2 text-sm font-semibold hover:bg-blue-700 transition-colors">
             Confirm Reservation
           </button>
        </form>
      </div>

      {/* MOBILE REQUEST MODAL DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Bell size={16} className="text-blue-600" /> Incoming Mobile Bookings
                </h4>
                <p className="text-[11px] text-slate-400">Review, approve, or clear queue requests.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {incomingRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <ShieldAlert size={24} className="text-slate-300" />
                  <p>No incoming app request entries found in queue.</p>
                </div>
              ) : (
                incomingRequests.map((req) => {
                  const timeMatch = standardTimeSlots.find(s => s.raw.substring(0, 5) === req.appointment_time?.substring(0, 5));
                  const displayTime = timeMatch ? timeMatch.display : req.appointment_time;
                  const patientDisplayName = patientMap.get(String(req.patient_id)) || req.patient_id;

                  return (
                    <div key={req.id || req.appointment_id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-700">{patientDisplayName}</span>
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Mobile App Submission</span>
                        </div>
                        <div className="text-slate-500 mt-1 space-x-3">
                          <span><strong>Date:</strong> {req.appointment_date?.split('T')[0]}</span>
                          <span><strong>Requested Time:</strong> {displayTime}</span>
                        </div>
                        <div className="text-slate-400 text-[11px] truncate mt-0.5 max-w-[350px]">
                          <strong>Purpose:</strong> {req.purpose_of_visit}
                        </div>
                      </div>
                     <div className="flex items-center space-x-2 self-end sm:self-center">
  {/* Cancel Request */}
  <button
    onClick={() => handleCancelRequest(req)}
    className="flex items-center space-x-1 px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 hover:text-rose-700 font-medium rounded-lg transition-colors"
  >
    <Ban size={12} />
    <span>Cancel</span>
  </button>

  {/* Accept Request */}
  <button
    onClick={() => handleAcceptRequest(req)}
    className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
  >
    <Check size={12} />
    <span>Accept</span>
  </button>
</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setIsModalOpen(false)} className="text-xs font-semibold px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white bg-slate-50 transition-colors">
                Close Queue Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT APPOINTMENT MODAL */}
      {editingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Pencil size={16} className="text-blue-600" /> Edit appointment
                </h4>
                <p className="text-[11px] text-slate-400">{patientMap.get(String(editingAppointment.patient_id)) || editingAppointment.patient_id}</p>
              </div>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-4">
              {editError && <div className="text-xs bg-red-50 text-red-600 p-2.5 rounded-lg border border-red-100">{editError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                <input type="date" min={todayString} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full text-sm border rounded-lg p-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Time Slot</label>
                <select value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full text-sm border rounded-lg p-2 bg-white">
                  {standardTimeSlots.map(slot => {
                    const ownSlot = editingAppointment.appointment_date?.split('T')[0] === editDate &&
                                   editingAppointment.appointment_time?.substring(0, 5) === slot.raw.substring(0, 5);
                    const isTaken = !ownSlot && takenSlots.some(s => s.date === editDate && s.time === slot.raw.substring(0, 5));
                    const isPastTime = isSlotInPast(editDate, slot.raw);
                    const isDisabled = (isTaken || isPastTime) && !ownSlot;

                    return (
                      <option key={slot.raw} value={slot.raw} disabled={isDisabled}>
                        {slot.display} {isTaken ? '(Reserved)' : isPastTime ? '(Passed)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Purpose of Visit</label>
                <input type="text" value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)} className="w-full text-sm border rounded-lg p-2" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={handleCancelAppointment} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800">
                  <Ban size={14} /> Cancel appointment
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={closeEditModal} className="text-xs font-semibold px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                    Close
                  </button>
                  <button type="submit" disabled={isSavingEdit} className="text-xs font-semibold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {isSavingEdit ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}