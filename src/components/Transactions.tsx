import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, QuerySnapshot, DocumentData, QueryDocumentSnapshot, getDocs, writeBatch, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Unit } from '../types';
import { format, parseISO, addMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircle, ArrowUpRight, ArrowDownRight, Tag, Trash2, Wallet, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import MaintenanceFees from './MaintenanceFees';

export default function Transactions({ isAdmin }: { isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState<'balance' | 'fees' | 'multas'>('balance');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [newTx, setNewTx] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    category: 'mantenimiento',
    unit_id: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [newMulta, setNewMulta] = useState({
    amount: '',
    description: '',
    unit_id: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    let txs: Transaction[] = [];
    let feeTxs: Transaction[] = [];

    const updateCombined = () => {
      const combined = [...txs, ...feeTxs];
      combined.sort((a: Transaction, b: Transaction) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      setTransactions(combined);
      setLoading(false);
    };

    const q = query(collection(db, 'transactions'));
    const unsubscribeTxs = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      txs = snapshot.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Transaction));
      updateCombined();
    });

    const qFees = query(collection(db, 'maintenance_fees'));
    const unsubscribeFees = onSnapshot(qFees, (snapshot: QuerySnapshot<DocumentData>) => {
      feeTxs = [];
      snapshot.forEach(doc => {
        const f = doc.data();
        if (f.status === 'paid') {
          const feeDate = parseISO(f.period + '-01');
          feeTxs.push({
            id: `fee-${doc.id}`,
            type: 'income',
            amount: f.amount,
            description: `Cuota de Mantenimiento - ${f.unit_id} (${f.period})`,
            category: 'mantenimiento',
            date: feeDate
          });
        }
      });
      updateCombined();
    });

    const unsubscribeUnits = onSnapshot(query(collection(db, 'units')), (snapshot) => {
      const u = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Unit));
      u.sort((a, b) => {
        if (a.tower !== b.tower) return a.tower.localeCompare(b.tower);
        return a.number - b.number;
      });
      setUnits(u);
    });

    return () => {
      unsubscribeTxs();
      unsubscribeFees();
      unsubscribeUnits();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const txDate = newTx.date ? parseISO(newTx.date) : new Date();
      // Ensure the time is somewhat correct to avoid timezone issues pushing it a day back, or just use the parsed date.
      
      const txData: any = {
        ...newTx,
        amount: parseFloat(newTx.amount),
        date: txDate
      };
      if (txData.category !== 'multa') {
        delete txData.unit_id;
      } else {
        txData.status = 'pending';
      }

      await addDoc(collection(db, 'transactions'), txData);
      setIsAdding(false);
      setNewTx({ type: 'income', amount: '', description: '', category: 'mantenimiento', unit_id: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const txDate = newMulta.date ? parseISO(newMulta.date) : new Date();
      await addDoc(collection(db, 'transactions'), {
        type: 'income',
        amount: parseFloat(newMulta.amount),
        description: newMulta.description,
        category: 'multa',
        unit_id: newMulta.unit_id,
        date: txDate,
        status: 'pending'
      });
      setIsAdding(false);
      setNewMulta({ amount: '', description: '', unit_id: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (err) {
      console.error(err);
    }
  };

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


  const handleClearAll = async () => {
    if (!isAdmin) return;
    
    setIsClearing(true);
    try {
      let q = query(collection(db, 'transactions'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (activeTab === 'multas') {
          if (data.category === 'multa') batch.delete(docSnap.ref);
        } else {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit();
      setShowConfirmClear(false);
    } catch (err) {
      console.error('Error clearing transactions:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  };

  const filteredTransactions = transactions.filter(tx => {
    let matchMonth = true;
    if (filterMonth) {
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      const txMonth = format(txDate, 'yyyy-MM');
      matchMonth = txMonth === filterMonth;
    }
    
    let matchCategory = true;
    if (activeTab === 'multas') {
      matchCategory = tx.category === 'multa';
    } else if (filterCategory) {
      matchCategory = tx.category === filterCategory;
    }
    
    if (activeTab === 'balance' && tx.category === 'multa' && tx.status === 'pending') {
      return false;
    }

    return matchMonth && matchCategory;
  });

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const date = addMonths(startOfMonth(new Date()), i - 6);
    return format(date, 'yyyy-MM');
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  if (loading) return <div className="text-gray-500">Cargando transacciones...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Finanzas</h2>
          <p className="text-sm text-gray-500 mt-1">Registro de ingresos y egresos</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('balance')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'balance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Balance General
          </button>
          <button
            onClick={() => setActiveTab('fees')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'fees' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Cuotas de Mantenimiento
          </button>
          <button
            onClick={() => setActiveTab('multas')}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'multas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Tag className="w-4 h-4 mr-2" />
            Multas
          </button>
        </div>
      </div>

      {activeTab === 'fees' ? (
        <MaintenanceFees isAdmin={isAdmin} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mes</label>
                <select 
                  value={filterMonth}
                  onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                  className="block w-full border-gray-300 rounded-lg text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 h-[38px]"
                >
                  <option value="">Todos</option>
                  {monthOptions.map(m => (
                    <option key={m} value={m}>
                      {format(parseISO(m + '-01'), "MMMM yyyy", { locale: es }).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              {activeTab === 'balance' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
                  <select 
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                    className="block w-full border-gray-300 rounded-lg text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 h-[38px]"
                  >
                    <option value="">Todas</option>
                    <option value="mantenimiento">Cuota de Mantenimiento</option>
                    <option value="reparacion">Reparación / Mantenimiento</option>
                    <option value="servicios">Servicios Básicos</option>
                    <option value="nomina">Nómina</option>
                    <option value="multa">Multa</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 w-full sm:w-auto">
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setShowConfirmClear(true)}
                    disabled={isClearing || filteredTransactions.length === 0}
                    className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center disabled:opacity-50 h-[38px] mt-5 sm:mt-0"
                  >
                    <Trash2 className="w-4 h-4 mr-2"/> {isClearing ? 'Borrando...' : 'Borrar Historial'}
                  </button>
                  <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center h-[38px] mt-5 sm:mt-0"
                  >
                    {isAdding ? 'Cancelar' : <><PlusCircle className="w-4 h-4 mr-2"/> {activeTab === 'multas' ? 'Nueva Multa' : 'Nueva Transacción'}</>}
                  </button>
                </>
              )}
            </div>
          </div>

          {showConfirmClear && isAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Borrar Historial</h3>
                <p className="text-sm text-gray-500 mb-6">
                  {activeTab === 'multas' 
                    ? '¿Estás seguro de que deseas eliminar todas las multas? Esta acción no se puede deshacer.'
                    : '¿Estás seguro de que deseas eliminar todas las transacciones? Esta acción no se puede deshacer.'}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowConfirmClear(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isClearing ? 'Borrando...' : 'Sí, borrar historial'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isAdding && isAdmin && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
              {activeTab === 'multas' ? (
                <form onSubmit={handleAddMulta} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Departamento</label>
                      <select required value={newMulta.unit_id} onChange={e => setNewMulta({...newMulta, unit_id: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">Seleccione...</option>
                        {units.map(u => (
                          <option key={u.id} value={u.id}>{u.tower} - {u.number}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Fecha</label>
                      <input required type="date" value={newMulta.date} onChange={e => setNewMulta({...newMulta, date: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Monto</label>
                      <input required type="number" step="0.01" value={newMulta.amount} onChange={e => setNewMulta({...newMulta, amount: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Descripción</label>
                      <input required type="text" value={newMulta.description} onChange={e => setNewMulta({...newMulta, description: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ej: Ruido excesivo" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Guardar Multa</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="lg:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Fecha</label>
                      <input required type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    {newTx.category === 'multa' ? (
                      <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Depto</label>
                        <select required value={newTx.unit_id} onChange={e => setNewTx({...newTx, unit_id: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                          <option value="">Seleccione...</option>
                          {units.map(u => (
                            <option key={u.id} value={u.id}>{u.tower} - {u.number}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Tipo</label>
                        <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value as any})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                          <option value="income">Ingreso</option>
                          <option value="expense">Egreso</option>
                        </select>
                      </div>
                    )}
                    <div className="lg:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Monto</label>
                      <input required type="number" step="0.01" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">Categoría</label>
                      <select value={newTx.category} onChange={e => {
                        const category = e.target.value;
                        setNewTx({...newTx, category, type: category === 'multa' ? 'income' : newTx.type});
                      }} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="reparacion">Reparación</option>
                        <option value="servicios">Servicios (Agua/Luz)</option>
                        <option value="nomina">Nómina</option>
                        <option value="multa">Multa</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Descripción</label>
                      <input required type="text" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ej: Pago de mantenimiento mensual" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Guardar Transacción</button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {currentTransactions.map((tx) => (
                <li key={tx.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Tag className="w-3 h-3 mr-1" />
                        <span className="capitalize">{tx.category}</span>
                        {tx.unit_id && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Apto {units.find(u => u.id === tx.unit_id)?.number || tx.unit_id}</span>
                          </>
                        )}
                        <span className="mx-2">•</span>
                        <span>{formatDate(tx.date)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-sm font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                    </div>
                    {activeTab === 'multas' && tx.status !== 'paid' && isAdmin && (
                      <button
                        onClick={() => handlePayMulta(tx.id)}
                        className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        Marcar Pagada
                      </button>
                    )}
                    {activeTab === 'multas' && tx.status === 'paid' && (
                      <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-medium">Pagada</span>
                    )}
                  </div>
                </li>
              ))}
              {filteredTransactions.length === 0 && (
                <li className="p-8 text-center text-gray-500 text-sm">
                  {activeTab === 'multas' ? 'No hay multas registradas.' : 'No hay transacciones registradas.'}
                </li>
              )}
            </ul>
            
            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredTransactions.length)}</span> de <span className="font-medium">{filteredTransactions.length}</span> registros
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                        disabled={safeCurrentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
                      >
                        <span className="sr-only">Anterior</span>
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        {safeCurrentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                        disabled={safeCurrentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
                      >
                        <span className="sr-only">Siguiente</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
                
                <div className="flex items-center justify-between w-full sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-700">
                    {safeCurrentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
