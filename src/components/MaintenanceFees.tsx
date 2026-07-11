import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Unit, MaintenanceFee } from '../types';
import { format, addMonths, startOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Clock, ChevronDown, ChevronRight, Building2 } from 'lucide-react';

export default function MaintenanceFees({ isAdmin }: { isAdmin: boolean }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [fees, setFees] = useState<MaintenanceFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM'));
  const [isSeeding, setIsSeeding] = useState(false);
  const [expandedTowers, setExpandedTowers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const qUnits = query(collection(db, 'units'));
    const unsubUnits = onSnapshot(qUnits, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
      setUnits(data.sort((a, b) => {
        if (a.tower !== b.tower) {
          return String(a.tower).localeCompare(String(b.tower));
        }
        return a.number - b.number;
      }));
    });

    const qFees = query(collection(db, 'maintenance_fees'));
    const unsubFees = onSnapshot(qFees, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceFee));
      setFees(data);
      setLoading(false);
    });

    return () => {
      unsubUnits();
      unsubFees();
    };
  }, []);

  const handleToggleStatus = async (unitId: string, currentFee: MaintenanceFee | undefined) => {
    if (!isAdmin) return;
    
    try {
      const batch = writeBatch(db);
      
      if (currentFee) {
        // Toggle status
        const feeRef = doc(db, 'maintenance_fees', currentFee.id);
        const newStatus = currentFee.status === 'paid' ? 'pending' : 'paid';
        batch.update(feeRef, {
          status: newStatus,
          paid_date: newStatus === 'paid' ? new Date() : null
        });
      } else {
        // Create new fee as paid
        const feeRef = doc(collection(db, 'maintenance_fees'));
        batch.set(feeRef, {
          unit_id: unitId,
          period: selectedMonth,
          amount: 2500, // Default fee amount, could be configured
          status: 'paid',
          paid_date: new Date()
        });
      }
      
      await batch.commit();
    } catch (err) {
      console.error("Error updating fee status", err);
    }
  };

  const generateTestData = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      
      const periods = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
      
      // Delete existing test fees for these units to avoid duplicates
      const existingFees = fees.filter(f => (f.unit_id === 'B2-5' || f.unit_id === 'B3-6') && periods.includes(f.period));
      existingFees.forEach(f => {
        batch.delete(doc(db, 'maintenance_fees', f.id));
      });

      // B2-5 (Pagado Enero a Julio)
      periods.forEach(period => {
        const feeRef = doc(collection(db, 'maintenance_fees'));
        batch.set(feeRef, {
          unit_id: 'B2-5',
          period,
          amount: 2500,
          status: 'paid',
          paid_date: new Date()
        });
      });

      // B3-6 (Pagado Enero a Mayo)
      periods.slice(0, 5).forEach(period => {
        const feeRef = doc(collection(db, 'maintenance_fees'));
        batch.set(feeRef, {
          unit_id: 'B3-6',
          period,
          amount: 2500,
          status: 'paid',
          paid_date: new Date()
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error generating data:', err);
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

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const date = addMonths(startOfMonth(new Date()), i - 6);
    return format(date, 'yyyy-MM');
  });

  if (loading) return <div className="text-gray-500 text-sm">Cargando cuotas...</div>;

  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const earliestPeriod = fees.length > 0 
    ? fees.reduce((min, f) => f.period < min ? f.period : min, currentMonthStr)
    : currentMonthStr;

  const periodsToCheck: string[] = [];
  let currDate = parseISO(earliestPeriod + '-01');
  const endDate = parseISO(currentMonthStr + '-01');
  while (currDate <= endDate) {
    periodsToCheck.push(format(currDate, 'yyyy-MM'));
    currDate = addMonths(currDate, 1);
  }

  // Group units by tower
  const groupedUnits = units.reduce((acc, unit) => {
    if (!acc[unit.tower]) {
      acc[unit.tower] = [];
    }
    acc[unit.tower].push(unit);
    return acc;
  }, {} as Record<string, Unit[]>);
  
  const towersList = Object.keys(groupedUnits).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Estado de Cuenta</h3>
          <p className="text-sm text-gray-500">Gestión de cuotas de mantenimiento mensuales</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {isAdmin && (
            <button
              onClick={generateTestData}
              disabled={isSeeding}
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 h-[38px] mt-5"
            >
              {isSeeding ? 'Generando...' : 'Generar Pruebas'}
            </button>
          )}
          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-gray-700 mb-1">Mes a visualizar</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="block w-full border-gray-300 rounded-lg text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 h-[38px]"
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>
                  {format(parseISO(m + '-01'), "MMMM yyyy", { locale: es }).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {towersList.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500 text-sm">
            No hay departamentos registrados.
          </div>
        )}
        
        {towersList.map((tower) => {
          const isExpanded = expandedTowers[tower];
          const towerUnits = groupedUnits[tower];
          const paidCount = towerUnits.filter(u => {
            return periodsToCheck.every(period => {
              const fee = fees.find(f => f.unit_id === u.id && f.period === period);
              return fee?.status === 'paid';
            });
          }).length;
          
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
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                    {paidCount} al corriente
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado de Pago ({selectedMonth})</th>
                          {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {towerUnits.map(unit => {
                          const fee = fees.find(f => f.unit_id === unit.id && f.period === selectedMonth);
                          const isPaid = fee?.status === 'paid';
                          
                          return (
                            <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-900">{unit.id}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {isPaid ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Check className="w-3 h-3 mr-1" />
                                    Pagado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pendiente / Adeudo
                                  </span>
                                )}
                              </td>
                              {isAdmin && (
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <button
                                    onClick={() => handleToggleStatus(unit.id, fee)}
                                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors border ${
                                      isPaid 
                                        ? 'border-gray-200 text-gray-600 hover:bg-gray-100' 
                                        : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                                    }`}
                                  >
                                    {isPaid ? 'Marcar Pendiente' : 'Marcar Pagado'}
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
    </div>
  );
}
