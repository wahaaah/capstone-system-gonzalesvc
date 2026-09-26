// src/components/PatientDirectory.tsx
import { useState, useEffect } from 'react';
import { Search, Eye, UserX, Plus, Pencil, Trash2, X, Loader2, FilePlus2, ShoppingBag, Maximize2, Receipt } from 'lucide-react';
import { patientService, type Patient } from '../services/patientService';
import { prescriptionService, type Prescription } from '../services/prescriptionService';
import { posService, type PatientTransaction } from '../services/posService';

export default function PatientDirectory() {
  // 1. Data Core State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prescription Data State
  const [activePrescription, setActivePrescription] = useState<Prescription | null>(null);
  const [isLoadingRx, setIsLoadingRx] = useState(false);

  // Transaction History State
  const [patientTransactions, setPatientTransactions] = useState<PatientTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // 2. Modal Interface System States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isRefractionModalOpen, setIsRefractionModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false); // Modal state for transaction history
  
  // 3. Form Input Binding States
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formGender, setFormGender] = useState('Male');
  const [formContact, setFormContact] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Pending' | 'Completed'>('Active');

  const [odSph, setOdSph] = useState('');
  const [odCyl, setOdCyl] = useState('');
  const [osSph, setOsSph] = useState('');
  const [osCyl, setOsCyl] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // Load live patient data on component mount
  useEffect(() => {
    fetchLiveRecords();
  }, []);

  // Query prescription & POS transaction data whenever patient selection changes
  useEffect(() => {
    if (selectedPatient) {
      fetchPrescription(selectedPatient.patient_id);
      fetchTransactions(selectedPatient.patient_id);
    } else {
      setActivePrescription(null);
      setPatientTransactions([]);
    }
  }, [selectedPatient]);

  const fetchLiveRecords = async () => {
    setIsLoading(true);
    try {
      const liveData = await patientService.getAll();
      setPatients(liveData);
    } catch (error) {
      console.error("Could not fetch database records:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrescription = async (patientId: string) => {
    setIsLoadingRx(true);
    try {
      const rxList = await prescriptionService.getForPatient(patientId);
      setActivePrescription(rxList.length > 0 ? rxList[rxList.length - 1] : null);
    } catch (error) {
      console.error("Could not fetch prescription record:", error);
      setActivePrescription(null);
    } finally {
      setIsLoadingRx(false);
    }
  };

  const fetchTransactions = async (patientId: string) => {
    setIsLoadingTx(true);
    try {
      const txList = await posService.getPatientTransactions(patientId);
      setPatientTransactions(txList);
    } catch (error) {
      console.error("Could not fetch patient transaction history:", error);
      setPatientTransactions([]);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormId(`GVC-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormName('');
    setFormAge('');
    setFormGender('Male');
    setFormContact('');
    setFormStatus('Active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('edit');
    setFormId(patient.patient_id);
    setFormName(patient.name);
    setFormAge(patient.age.toString());
    setFormGender(patient.gender);
    setFormContact(patient.contact);
    setFormStatus(patient.status);
    setIsModalOpen(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAge || !formContact.trim()) {
      alert("Please fill in all required fields.");
      return;
    }

    const payload: Patient = {
      patient_id: formId,
      name: formName.trim(),
      age: parseInt(formAge),
      gender: formGender,
      contact: formContact.trim(),
      last_visit: modalMode === 'add' ? 'Not yet recorded' : (selectedPatient?.last_visit || 'Not yet recorded'),
      status: formStatus,
    };

    setIsSubmitting(true);

    try {
      if (modalMode === 'add') {
        const freshDatabaseRow = await patientService.create(payload);
        setPatients(prev => [freshDatabaseRow, ...prev]);
        setSelectedPatient(freshDatabaseRow);
      } else {
        const modifiedRow = await patientService.update(formId, payload);
        setPatients(prev => prev.map(p => p.patient_id === formId ? modifiedRow : p));

        if (formStatus === 'Completed') {
          const pendingTxs = patientTransactions.filter(tx => tx.payment_status === 'Pending');
          if (pendingTxs.length > 0) {
            await Promise.all(
              pendingTxs.map(tx => posService.updateTransactionStatus(tx.transaction_id, 'Paid'))
            );
          }
        }

        if (selectedPatient?.patient_id === formId) {
          setSelectedPatient(modifiedRow);
          await fetchTransactions(formId);
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Save sequence error:", error);
      alert("Database write error occurred during save sequence.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to permanently erase profile reference ${id}?`)) return;

    setIsLoading(true);
    try {
      const verifySuccess = await patientService.delete(id);
      if (verifySuccess) {
        setPatients(prev => prev.filter(p => p.patient_id !== id));
        if (selectedPatient?.patient_id === id) setSelectedPatient(null);
      }
    } catch (error) {
      alert("Could not complete target data sweep.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRefraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setIsSubmittingRx(true);

    const payload = {
      patient_id: selectedPatient.patient_id,
      od_sph: odSph || null,
      od_cyl: odCyl || null,
      os_sph: osSph || null,
      os_cyl: osCyl || null,
      notes: rxNotes || null,
    };

    try {
      if (activePrescription?.prescription_id) {
        await prescriptionService.update(activePrescription.prescription_id, payload);
      } else {
        await prescriptionService.create(payload);
      }
      
      setIsRefractionModalOpen(false);
      await fetchPrescription(selectedPatient.patient_id);

      setOdSph('');
      setOdCyl('');
      setOsSph('');
      setOsCyl('');
      setRxNotes('');
    } catch (error) {
      console.error("Refraction save error:", error);
      alert("Could not save prescription record.");
    } finally {
      setIsSubmittingRx(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search database by patient name or track ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors w-full sm:w-auto justify-center cursor-pointer"
        >
          <Plus size={16} />
          <span>Register New Patient</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-md border border-slate-100">
                <Loader2 size={18} className="animate-spin text-blue-600" />
                <span className="text-xs font-semibold text-slate-600 tracking-wide">Querying MariaDB Engine...</span>
              </div>
            </div>
          )}

          {/* =====================================================
              DESKTOP PATIENT TABLE
              Hidden on small screens so the records do not
              become horizontally squeezed.
          ===================================================== */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-medium">
                  <th className="p-4">Patient ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Age / Sex</th>
                  <th className="p-4">Last Visit</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <tr key={patient.patient_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-blue-600">{patient.patient_id}</td>
                      <td className="p-4 font-medium text-slate-900">{patient.name}</td>
                      <td className="p-4 text-slate-600">{patient.age} yrs / {patient.gender}</td>
                      <td className="p-4 text-slate-500 font-mono text-xs">{patient.last_visit}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          patient.status === 'Active'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : patient.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {patient.status}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6 space-x-1">
                        <button
                          onClick={() => setSelectedPatient(patient)}
                          className="inline-flex items-center text-slate-500 hover:text-blue-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Open Clinical Preview"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={(e) => handleOpenEditModal(patient, e)}
                          className="inline-flex items-center text-slate-500 hover:text-amber-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Modify Account Properties"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeletePatient(patient.patient_id, e)}
                          className="inline-flex items-center text-slate-500 hover:text-red-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Purge Profile"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <UserX size={24} className="text-slate-300" />
                        <span>No matched patient indexes found in MariaDB.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* =====================================================
              MOBILE PATIENT CARDS
              Replaces the wide table on phones.
          ===================================================== */}
          <div className="sm:hidden p-3 space-y-3">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div
                  key={patient.patient_id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {/* Patient name + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                        {patient.patient_id}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900 break-words">
                        {patient.name}
                      </p>
                    </div>

                    <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${
                      patient.status === 'Active'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : patient.status === 'Pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {patient.status}
                    </span>
                  </div>

                  {/* Patient details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-3 border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Age / Sex
                      </p>
                      <p className="mt-1 text-xs text-slate-700 break-words">
                        {patient.age} yrs / {patient.gender}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Last Visit
                      </p>
                      <p className="mt-1 text-xs text-slate-600 break-words">
                        {patient.last_visit || 'No visits'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedPatient(patient)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                      title="Open Clinical Preview"
                    >
                      <Eye size={14} />
                      <span>View</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenEditModal(patient, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                      title="Modify Account Properties"
                    >
                      <Pencil size={14} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={(e) => handleDeletePatient(patient.patient_id, e)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                      title="Purge Profile"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <UserX size={24} className="text-slate-300" />
                  <span className="text-xs">
                    No matched patient indexes found in MariaDB.
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 text-xs text-slate-400 font-medium">
            Live Row Target Context: {filteredPatients.length} profiles loaded from schema
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Clinical Summary Preview
          </h3>
          
          {selectedPatient ? (
            <div className="space-y-5">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{selectedPatient.name}</h4>
                <p className="text-xs text-slate-400">ID: {selectedPatient.patient_id} • Tel: {selectedPatient.contact}</p>
              </div>

              <hr className="border-slate-100" />

              <div>
                <h5 className="text-xs font-bold text-slate-700 uppercase mb-3 tracking-wide">
                  Active Refraction Matrix
                </h5>

                {isLoadingRx ? (
                  <div className="flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                    <span className="text-xs text-slate-500">Loading prescription data...</span>
                  </div>
                ) : activePrescription ? (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-3 font-semibold border-b border-slate-200 pb-2 text-slate-500 uppercase tracking-wider">
                      <span>Eye</span>
                      <span>Sphere</span>
                      <span>Cylinder</span>
                    </div>
                    
                    <div className="grid grid-cols-3 text-slate-800 items-center">
                      <span className="font-bold text-blue-600">OD (Right)</span>
                      <span className="font-mono">{activePrescription.od_sph || '0.00'}</span>
                      <span className="font-mono">{activePrescription.od_cyl || '0.00'}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 text-slate-800 items-center">
                      <span className="font-bold text-blue-600">OS (Left)</span>
                      <span className="font-mono">{activePrescription.os_sph || '0.00'}</span>
                      <span className="font-mono">{activePrescription.os_cyl || '0.00'}</span>
                    </div>

                    {activePrescription.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Notes</span>
                        <p className="text-slate-600 italic mt-0.5">{activePrescription.notes}</p>
                      </div>
                    )}

                    <button 
                      onClick={() => {
                        setOdSph(activePrescription.od_sph || '');
                        setOdCyl(activePrescription.od_cyl || '');
                        setOsSph(activePrescription.os_sph || '');
                        setOsCyl(activePrescription.os_cyl || '');
                        setRxNotes(activePrescription.notes || '');
                        setIsRefractionModalOpen(true);
                      }}
                      className="w-full mt-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Update Refraction
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 text-center space-y-3">
                    <p className="text-xs text-slate-500 italic">
                      This profile represents a new registration instance. No eye exams or prescription entries are currently linked.
                    </p>
                    <button 
                      onClick={() => {
                        setOdSph('');
                        setOdCyl('');
                        setOsSph('');
                        setOsCyl('');
                        setRxNotes('');
                        setIsRefractionModalOpen(true);
                      }}
                      className="w-full inline-flex items-center justify-center space-x-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                      <FilePlus2 size={14} />
                      <span>Create Refraction File</span>
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              {/* Purchase & Transaction History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingBag size={14} className="text-slate-400" />
                    <span>Purchase & POS History</span>
                  </h5>
                  {patientTransactions.length > 0 && (
                    <button
                      onClick={() => setIsTxModalOpen(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                      title="Expand full history modal"
                    >
                      <span>Expand</span>
                      <Maximize2 size={12} />
                    </button>
                  )}
                </div>

                {isLoadingTx ? (
                  <div className="flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                    <span className="text-xs text-slate-500">Loading purchase records...</span>
                  </div>
                ) : patientTransactions.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {patientTransactions.map((tx) => (
                      <div key={tx.transaction_id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Receipt {tx.transaction_id} • {new Date(tx.created_at).toLocaleDateString()}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.payment_status === 'Paid'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {tx.payment_status}
                          </span>
                        </div>
                        <div className="text-slate-600 font-mono text-[11px]">
                          {tx.items_summary || 'Consultation / Clinic Service'}
                        </div>
                        <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/60">
                          <span className="text-[10px]">Purpose: {tx.purpose_of_visit || 'N/A'}</span>
                          <span className="font-bold text-blue-600">₱{Number(tx.total_amount).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 text-center">
                    <p className="text-xs text-slate-500 italic">
                      No POS transactions or frame/lens purchases recorded for this patient.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              Select a visual record eye action from the main directory ledger matrix to stream profile information.
            </div>
          )}
        </div>
      </div>

      {/* 1. Register / Edit Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900">
                {modalMode === 'add' ? 'Register New Patient Account' : `Modify Metadata File: ${formId}`}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Age</label>
                  <input 
                    type="number" 
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Gender Identification</label>
                  <select 
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Contact Phone Number</label>
                <input 
                  type="text" 
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="e.g. 0917-000-0000"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Operational State Classification</label>
                <select 
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'Active' | 'Pending' | 'Completed')}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100 justify-end text-sm">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 inline-flex items-center space-x-2 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Account Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Refraction Modal */}
      {isRefractionModalOpen && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                Refraction Record: {selectedPatient.name} ({selectedPatient.patient_id})
              </h3>
              <button onClick={() => setIsRefractionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRefraction} className="p-6 space-y-4 text-xs">
              <div className="space-y-3">
                <p className="font-bold uppercase text-slate-400 tracking-wide">Right Eye (OD)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Sphere (SPH)</label>
                    <input 
                      type="text" 
                      placeholder="-1.25"
                      value={odSph}
                      onChange={(e) => setOdSph(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Cylinder (CYL)</label>
                    <input 
                      type="text" 
                      placeholder="-0.50"
                      value={odCyl}
                      onChange={(e) => setOdCyl(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <p className="font-bold uppercase text-slate-400 tracking-wide">Left Eye (OS)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Sphere (SPH)</label>
                    <input 
                      type="text" 
                      placeholder="-1.50"
                      value={osSph}
                      onChange={(e) => setOsSph(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Cylinder (CYL)</label>
                    <input 
                      type="text" 
                      placeholder="-0.75"
                      value={osCyl}
                      onChange={(e) => setOsCyl(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-slate-500 mb-1 font-medium">Clinical / Lens Notes</label>
                <textarea 
                  rows={3}
                  placeholder="Additional optometrist observations or recommendation details..."
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsRefractionModalOpen(false)} 
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingRx}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold inline-flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingRx && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Refraction Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Dedicated Full Transaction History Modal */}
      {isTxModalOpen && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Receipt size={18} className="text-blue-600" />
                  Transaction & Purchase History
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedPatient.name} ({selectedPatient.patient_id})
                </p>
              </div>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {isLoadingTx ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-blue-600 mr-2" />
                  <span className="text-xs text-slate-500">Retrieving transaction ledger...</span>
                </div>
              ) : patientTransactions.length > 0 ? (
                patientTransactions.map((tx) => (
                  <div key={tx.transaction_id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">
                        Receipt {tx.transaction_id} • {new Date(tx.created_at).toLocaleDateString()}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        tx.payment_status === 'Paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {tx.payment_status}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-700 font-mono leading-relaxed">
                        {tx.items_summary || 'Consultation / Clinic Service'}
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-slate-400">Purpose: {tx.purpose_of_visit || 'N/A'}</span>
                      <span className="font-bold text-blue-600 text-sm">
                        ₱{Number(tx.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No transaction records found for this patient profile.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-200/80 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}