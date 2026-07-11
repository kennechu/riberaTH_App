import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, writeBatch, QuerySnapshot, DocumentData, QueryDocumentSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Unit } from '../types';
import { Users as UsersIcon, UserPlus, Mail, Building2, Edit2, Trash2, X } from 'lucide-react';

export default function Residents({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'owner' as 'admin' | 'owner' | 'tenant',
    unit_id: ''
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'owner' as 'admin' | 'owner' | 'tenant',
    unit_id: ''
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as User));
      setUsers(data);
      setLoading(false);
    });
    
    const qUnits = query(collection(db, 'units'));
    const unsubUnits = onSnapshot(qUnits, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Unit));
      setUnits(data.sort((a: Unit, b: Unit) => {
        if (a.tower !== b.tower) return String(a.tower).localeCompare(String(b.tower));
        return a.number - b.number;
      }));
    });

    return () => {
      unsubUsers();
      unsubUnits();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const newUserId = newUser.role + '_' + Date.now().toString();
      
      const userRef = doc(collection(db, 'users'), newUserId);
      batch.set(userRef, {
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        unit_id: newUser.unit_id || null
      });

      if (newUser.unit_id) {
        const unitRef = doc(collection(db, 'units'), newUser.unit_id);
        if (newUser.role === 'tenant') {
          batch.update(unitRef, { tenant_id: newUserId });
        } else {
          batch.update(unitRef, { owner_id: newUserId });
        }
      }

      await batch.commit();
      setIsAdding(false);
      setNewUser({ name: '', email: '', role: 'owner', unit_id: '' });
    } catch (err) {
      console.error("Error adding resident:", err);
      alert("Hubo un error al registrar el residente.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !isAdmin) return;
    
    try {
      const batch = writeBatch(db);
      const ref = doc(db, 'users', editingUser.id);
      
      batch.update(ref, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        unit_id: editForm.unit_id || null
      });

      // If unit changed or role changed, we need to clean up the old unit
      if (editingUser.unit_id && (editingUser.unit_id !== editForm.unit_id || editingUser.role !== editForm.role)) {
        const oldUnitRef = doc(db, 'units', editingUser.unit_id);
        if (editingUser.role === 'tenant') {
          batch.update(oldUnitRef, { tenant_id: null });
        } else {
          batch.update(oldUnitRef, { owner_id: null });
        }
      }

      // Assign to the new unit
      if (editForm.unit_id) {
        const newUnitRef = doc(db, 'units', editForm.unit_id);
        if (editForm.role === 'tenant') {
          batch.update(newUnitRef, { tenant_id: editingUser.id });
        } else {
          batch.update(newUnitRef, { owner_id: editingUser.id });
        }
      }

      await batch.commit();
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', userId);
      batch.delete(userRef);

      // Clean up references in units
      const unitsOwnerQ = query(collection(db, 'units'), where('owner_id', '==', userId));
      const unitsOwnerSnap = await getDocs(unitsOwnerQ);
      unitsOwnerSnap.forEach(uDoc => {
        batch.update(uDoc.ref, { owner_id: null });
      });

      const unitsTenantQ = query(collection(db, 'units'), where('tenant_id', '==', userId));
      const unitsTenantSnap = await getDocs(unitsTenantQ);
      unitsTenantSnap.forEach(uDoc => {
        batch.update(uDoc.ref, { tenant_id: null });
      });

      await batch.commit();
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  if (loading) return <div className="text-gray-500">Cargando residentes...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Residentes</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de propietarios e inquilinos</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center"
          >
            {isAdding ? 'Cancelar' : <><UserPlus className="w-4 h-4 mr-2"/> Nuevo Residente</>}
          </button>
        )}
      </div>

      {isAdding && isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="ejemplo@correo.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="admin">Administrador</option>
                  <option value="owner">Propietario</option>
                  <option value="tenant">Inquilino</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Departamento (Opcional)</label>
                <select value={newUser.unit_id} onChange={e => setNewUser({...newUser, unit_id: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">-- Seleccionar Departamento --</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.id}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Guardar Residente</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento Asignado</th>
                {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center">
                        <UsersIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <Mail className="w-3 h-3 mr-1" /> {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'owner' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {u.role === 'admin' ? 'Administrador' : u.role === 'owner' ? 'Propietario' : 'Inquilino'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {u.unit_id ? (
                      <div className="flex items-center text-sm font-medium text-gray-900">
                        <Building2 className="w-4 h-4 mr-1.5 text-gray-400" />
                        {u.unit_id}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Sin asignar</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setEditForm({
                            name: u.name,
                            email: u.email,
                            role: u.role,
                            unit_id: u.unit_id || ''
                          });
                        }}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors inline-flex items-center mr-2"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowConfirmDelete(u.id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors inline-flex items-center"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No hay residentes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Editar Residente</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <input required type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <input required type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value as any})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="admin">Administrador</option>
                  <option value="owner">Propietario</option>
                  <option value="tenant">Inquilino</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Departamento (Opcional)</label>
                <select value={editForm.unit_id} onChange={e => setEditForm({...editForm, unit_id: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">-- Seleccionar Departamento --</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.id}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Residente</h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro de que deseas eliminar este residente? Esta acción no se puede deshacer y liberará cualquier departamento asignado.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showConfirmDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
