import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, writeBatch, doc, getDocs, QuerySnapshot, DocumentData, QueryDocumentSnapshot, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Unit, Transaction } from '../types';
import { Building2, User, Key, Database, ChevronDown, ChevronRight, Edit2, X, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function Units({ isAdmin }: { isAdmin: boolean }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [multasMap, setMultasMap] = useState<Record<string, Transaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [expandedTowers, setExpandedTowers] = useState<Record<string, boolean>>({});

  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [selectedUnitMultas, setSelectedUnitMultas] = useState<Unit | null>(null);
  const [editForm, setEditForm] = useState({
    status: 'available',
    owner_id: '',
    tenant_id: ''
  });

  useEffect(() => {
    const qUnits = query(collection(db, 'units'));
    const unsubUnits = onSnapshot(qUnits, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Unit));
      // Sort in memory to avoid needing composite index
      data.sort((a: Unit, b: Unit) => {
        if (a.tower !== b.tower) {
          return String(a.tower).localeCompare(String(b.tower));
        }
        return a.number - b.number;
      });
      setUnits(data);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching units:", error);
      setLoading(false);
    });
    
    const unsubUsers = onSnapshot(query(collection(db, 'users')), (snapshot: QuerySnapshot<DocumentData>) => {
      const uMap: Record<string, string> = {};
      snapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        uMap[docSnap.id] = docSnap.data().name;
      });
      setUsersMap(uMap);
    });

    const unsubMultas = onSnapshot(query(collection(db, 'transactions'), where('category', '==', 'multa')), (snapshot: QuerySnapshot<DocumentData>) => {
      const mMap: Record<string, Transaction[]> = {};
      snapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const tx = { id: docSnap.id, ...docSnap.data() } as Transaction;
        if (tx.unit_id) {
          if (!mMap[tx.unit_id]) mMap[tx.unit_id] = [];
          mMap[tx.unit_id].push(tx);
        }
      });
      setMultasMap(mMap);
    });
    
    return () => {
      unsubUnits();
      unsubUsers();
      unsubMultas();
    };
  }, []);

  const generateMockUnits = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    try {
      // First, get all existing units and delete them in chunks if necessary
      const existingDocs = await getDocs(collection(db, 'units'));
      const batchDelete = writeBatch(db);
      existingDocs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        batchDelete.delete(docSnap.ref);
      });
      if (!existingDocs.empty) {
        await batchDelete.commit();
      }

      // Generate 84 new units (6 towers: A1, A2, A3, B1, B2, B3 with 14 units each)
      const batch = writeBatch(db);
      const towers = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
      
      for (const tower of towers) {
        for (let i = 1; i <= 14; i++) {
          const unitId = `${tower}-${i.toString().padStart(2, '0')}`;
          const ref = doc(collection(db, 'units'), unitId);
          batch.set(ref, {
            number: i,
            tower: tower,
            owner_id: null,
            tenant_id: null
          });
        }
      }
      await batch.commit();
    } catch (err) {
      console.error("Error generating mock units:", err);
      alert("Error al generar los departamentos. Por favor revisa la consola.");
    } finally {
      setIsSeeding(false);
    }
  };

  const toggleTower = (tower: string) => {
    setExpandedTowers(prev => ({
      ...prev,
      [tower]: !prev[tower]
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !isAdmin) return;
    
    try {
      const ref = doc(db, 'units', editingUnit.id);
      let updates: any = { owner_id: null, tenant_id: null };
      
      if (editForm.status === 'owned') {
        updates = { owner_id: editForm.owner_id || null, tenant_id: null };
      } else if (editForm.status === 'rented') {
        updates = { owner_id: editForm.owner_id || null, tenant_id: editForm.tenant_id || null };
      }

      await writeBatch(db).update(ref, updates).commit();
      setEditingUnit(null);
    } catch (err) {
      console.error('Error updating unit:', err);
    }
  };

  if (loading) return <div className="text-gray-500">Cargando departamentos...</div>;

  // Group units by tower
  const groupedUnits = units.reduce((acc, unit) => {
    if (!acc[unit.tower]) {
      acc[unit.tower] = [];
    }
    acc[unit.tower].push(unit);
    return acc;
  }, {} as Record<string, Unit[]>);
  
  const towersList = Object.keys(groupedUnits).sort((a, b) => a.localeCompare(b));

  const handlePayMulta = async (txId: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'transactions', txId), {
        status: 'paid',
        date: new Date()
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Directorio de Departamentos</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de departamentos y asignaciones</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button 
              onClick={generateMockUnits}
              disabled={isSeeding}
              className="flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Database className="w-4 h-4 mr-2" />
              {isSeeding ? 'Generando...' : 'Regenerar 84 Departamentos'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {towersList.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500 text-sm">
            No hay departamentos registrados. {isAdmin ? 'Genera los datos de prueba o añade departamentos manualmente.' : 'Contacta a un administrador para más información.'}
          </div>
        )}
        
        {towersList.map((tower) => {
          const isExpanded = expandedTowers[tower];
          const towerUnits = groupedUnits[tower];
          const occupiedCount = towerUnits.filter(u => (u.owner_id && usersMap[u.owner_id]) || (u.tenant_id && usersMap[u.tenant_id])).length;
          
          return (
            <div key={tower} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button 
                onClick={() => toggleTower(tower)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <div className="flex items-center space-x-3">
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    <span className="font-bold text-gray-900 text-lg">Torre {tower}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{towerUnits.length} departamentos</span>
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium">
                    {occupiedCount} ocupados
                  </span>
                </div>
              </button>
              
              {isExpanded && (
                <div className="border-t border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Propietario</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inquilino</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Multas</th>
                          {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {towerUnits.map((unit) => {
                          const unitMultas = multasMap[unit.id] || [];
                          const pendingMultas = unitMultas.filter(m => m.status === 'pending');
                          const hasMultas = pendingMultas.length > 0;
                          return (
                          <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">{unit.id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {unit.tenant_id && usersMap[unit.tenant_id] ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Alquilado
                                </span>
                              ) : unit.owner_id && usersMap[unit.owner_id] ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Ocupado por dueño
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Disponible
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unit.owner_id && usersMap[unit.owner_id] ? (
                                <div className="flex items-center">
                                  <Key className="h-4 w-4 mr-1.5 text-gray-400" />
                                  {usersMap[unit.owner_id]}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unit.tenant_id && usersMap[unit.tenant_id] ? (
                                <div className="flex items-center">
                                  <User className="h-4 w-4 mr-1.5 text-gray-400" />
                                  {usersMap[unit.tenant_id]}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {hasMultas ? (
                                <button
                                  onClick={() => setSelectedUnitMultas(unit)}
                                  className="inline-flex items-center justify-center p-1.5 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                                  title={`${pendingMultas.length} multa(s) pendiente(s)`}
                                >
                                  <AlertTriangle className="h-5 w-5" />
                                </button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => {
                                    setEditingUnit(unit);
                                    setEditForm({
                                      status: (unit.tenant_id && usersMap[unit.tenant_id]) ? 'rented' : (unit.owner_id && usersMap[unit.owner_id]) ? 'owned' : 'available',
                                      owner_id: unit.owner_id || '',
                                      tenant_id: unit.tenant_id || ''
                                    });
                                  }}
                                  className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors inline-flex items-center"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Editar Departamento {editingUnit.id}</h3>
              <button 
                onClick={() => setEditingUnit(null)}
                className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <select 
                  value={editForm.status} 
                  onChange={e => setEditForm({...editForm, status: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="available">Disponible</option>
                  <option value="owned">Ocupado por dueño</option>
                  <option value="rented">Alquilado</option>
                </select>
              </div>

              {(editForm.status === 'owned' || editForm.status === 'rented') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Propietario</label>
                  <select 
                    value={editForm.owner_id} 
                    onChange={e => setEditForm({...editForm, owner_id: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Seleccionar --</option>
                    {Object.entries(usersMap).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {editForm.status === 'rented' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Inquilino</label>
                  <select 
                    value={editForm.tenant_id} 
                    onChange={e => setEditForm({...editForm, tenant_id: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Seleccionar --</option>
                    {Object.entries(usersMap).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
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

      {selectedUnitMultas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Multas Pendientes - {selectedUnitMultas.id}
              </h3>
              <button 
                onClick={() => setSelectedUnitMultas(null)}
                className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 bg-red-50 shrink-0 border-b border-red-100">
              <p className="text-sm font-medium text-red-800 uppercase tracking-wide">Total Pendiente</p>
              <p className="text-3xl font-black text-red-600 mt-1">
                ${(multasMap[selectedUnitMultas.id] || []).filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + tx.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {(multasMap[selectedUnitMultas.id] || []).map(tx => {
                const date = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
                return (
                  <div key={tx.id} className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-gray-900">{tx.description}</p>
                      <p className="font-bold text-gray-900">${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-sm text-gray-500">{format(date, 'dd MMM yyyy')}</p>
                      {tx.status !== 'paid' && isAdmin && (
                        <button
                          onClick={() => handlePayMulta(tx.id)}
                          className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Marcar Pagada
                        </button>
                      )}
                      {tx.status === 'paid' && (
                        <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-medium">Pagada</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!multasMap[selectedUnitMultas.id] || multasMap[selectedUnitMultas.id].length === 0) && (
                <p className="text-center text-gray-500 text-sm py-4">No hay multas registradas.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
