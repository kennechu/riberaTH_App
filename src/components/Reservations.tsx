import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Reservation } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';

export default function Reservations({ isAdmin }: { isAdmin: boolean }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newRes, setNewRes] = useState({
    unit_id: '',
    amenity: 'Casa Club',
    date: '',
    start_time: '',
    end_time: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'reservations'));
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Reservation));
      // Sort by date descending
      data.sort((a: Reservation, b: Reservation) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setReservations(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, 'reservations'), {
        ...newRes,
        date: new Date(newRes.date),
        status: 'pending'
      });
      setIsAdding(false);
      setNewRes({ unit_id: '', amenity: 'Casa Club', date: '', start_time: '', end_time: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'reservations', id), { status });
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  };

  if (loading) return <div className="text-gray-500">Cargando reservaciones...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Reservaciones</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de áreas comunes</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {isAdding ? 'Cancelar' : 'Nueva Reservación'}
          </button>
        )}
      </div>

      {isAdding && isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Unidad</label>
                <input required type="text" value={newRes.unit_id} onChange={e => setNewRes({...newRes, unit_id: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ej: A1-01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Área</label>
                <select value={newRes.amenity} onChange={e => setNewRes({...newRes, amenity: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="Casa Club">Casa Club</option>
                  <option value="Alberca">Alberca</option>
                  <option value="Asador">Asador</option>
                  <option value="Salón de Eventos">Salón de Eventos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha</label>
                <input required type="date" value={newRes.date} onChange={e => setNewRes({...newRes, date: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hora Inicio</label>
                <input required type="time" value={newRes.start_time} onChange={e => setNewRes({...newRes, start_time: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hora Fin</label>
                <input required type="time" value={newRes.end_time} onChange={e => setNewRes({...newRes, end_time: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Guardar Reservación</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {reservations.map((res) => (
            <li key={res.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{res.amenity}</h3>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-gray-400" /> Unidad {res.unit_id}
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" /> {formatDate(res.date)}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-gray-400" /> {res.start_time} - {res.end_time}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    res.status === 'approved' ? 'bg-green-100 text-green-800' :
                    res.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {res.status === 'approved' ? 'Aprobada' : res.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                  </span>
                  
                  {res.status === 'pending' && isAdmin && (
                    <div className="flex space-x-2">
                      <button onClick={() => updateStatus(res.id, 'approved')} className="text-green-600 hover:bg-green-50 p-1.5 rounded-md transition-colors" title="Aprobar">
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button onClick={() => updateStatus(res.id, 'rejected')} className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="Rechazar">
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
          {reservations.length === 0 && (
            <li className="p-8 text-center text-gray-500 text-sm">
              No hay reservaciones registradas.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
