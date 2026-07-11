import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction, Unit, MaintenanceFee, User } from '../types';
import { DollarSign, Home, TrendingDown, AlertCircle } from 'lucide-react';
import { isSameMonth, parseISO, format, addMonths } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    balance: 0,
    income: 0,
    expense: 0,
    paidFines: 0,
    occupiedUnits: 0,
    totalUnits: 0,
    pendingReservations: 0,
    overdueBalance: 0
  });

  useEffect(() => {
    let currentIncome = 0;
    let currentExpense = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let paidFinesTotal = 0;

    const currentMonthDate = new Date();

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot: QuerySnapshot<DocumentData>) => {
      let tInc = 0;
      let tExp = 0;
      let mInc = 0;
      let mExp = 0;
      let pFines = 0;
      
      snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const t = doc.data() as Transaction;
        const txDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        
        if (t.type === 'income' && t.status !== 'pending') {
          tInc += t.amount;
          if (isSameMonth(txDate, currentMonthDate)) mInc += t.amount;
        }
        if (t.type === 'expense') {
          tExp += t.amount;
          if (isSameMonth(txDate, currentMonthDate)) mExp += t.amount;
        }
        if (t.category === 'multa' && t.status === 'paid') {
          pFines += t.amount;
        }
      });
      
      totalIncome = tInc;
      totalExpense = tExp;
      currentIncome = mInc;
      currentExpense = mExp;
      paidFinesTotal = pFines;
      updateStats();
    });

    let maintenanceFeesIncomeTotal = 0;
    let maintenanceFeesIncomeCurrentMonth = 0;
    let feesList: MaintenanceFee[] = [];

    const unsubFees = onSnapshot(collection(db, 'maintenance_fees'), (snapshot: QuerySnapshot<DocumentData>) => {
      let mTotal = 0;
      let mCurrent = 0;
      feesList = [];
      snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const f = doc.data() as MaintenanceFee;
        feesList.push(f);
        if (f.status === 'paid') {
          mTotal += f.amount;
          // Check if the fee period matches the current month
          const feeDate = parseISO(f.period + '-01');
          if (isSameMonth(feeDate, currentMonthDate)) {
            mCurrent += f.amount;
          }
        }
      });
      maintenanceFeesIncomeTotal = mTotal;
      maintenanceFeesIncomeCurrentMonth = mCurrent;
      updateStats();
      updateDerivedStats();
    });

    const updateStats = () => {
      setStats(s => ({
        ...s,
        income: currentIncome + maintenanceFeesIncomeCurrentMonth,
        expense: currentExpense,
        paidFines: paidFinesTotal,
        balance: (totalIncome + maintenanceFeesIncomeTotal) - totalExpense
      }));
    };

    let usersMap: Record<string, User> = {};
    let unitsList: Unit[] = [];

    const updateDerivedStats = () => {
      let occupied = 0;
      let overdue = 0;

      const currentMonthStr = format(currentMonthDate, 'yyyy-MM');
      const earliestPeriod = feesList.length > 0 
        ? feesList.reduce((min, f) => f.period < min ? f.period : min, currentMonthStr)
        : currentMonthStr;

      const periodsToCheck: string[] = [];
      let currDate = parseISO(earliestPeriod + '-01');
      const endDate = parseISO(currentMonthStr + '-01');
      while (currDate <= endDate) {
        periodsToCheck.push(format(currDate, 'yyyy-MM'));
        currDate = addMonths(currDate, 1);
      }

      unitsList.forEach((u) => {
        if ((u.tenant_id && usersMap[u.tenant_id]) || (u.owner_id && usersMap[u.owner_id])) {
          occupied++;
          periodsToCheck.forEach(period => {
            const fee = feesList.find(f => f.unit_id === u.id && f.period === period);
            if (!fee || fee.status !== 'paid') {
              overdue += fee ? fee.amount : 2500;
            }
          });
        }
      });
      setStats(s => ({ ...s, totalUnits: unitsList.length, occupiedUnits: occupied, overdueBalance: overdue }));
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot: QuerySnapshot<DocumentData>) => {
      const newMap: Record<string, User> = {};
      snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        newMap[doc.id] = { id: doc.id, ...doc.data() } as User;
      });
      usersMap = newMap;
      updateDerivedStats();
    });

    const unsubUnits = onSnapshot(collection(db, 'units'), (snapshot: QuerySnapshot<DocumentData>) => {
      unitsList = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data() as Unit);
      updateDerivedStats();
    });

    const qPendingRes = query(collection(db, 'reservations'), where('status', '==', 'pending'));
    const unsubReservations = onSnapshot(qPendingRes, (snapshot: QuerySnapshot<DocumentData>) => {
      setStats(s => ({ ...s, pendingReservations: snapshot.size }));
    });

    return () => {
      unsubTransactions();
      unsubFees();
      unsubUsers();
      unsubUnits();
      unsubReservations();
    };
  }, []);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Resumen del estado del condominio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Balance Total</h3>
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(stats.balance)}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Multas Pagadas</h3>
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(stats.paidFines)}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Gastos Mensuales</h3>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(stats.expense)}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Unidades Ocupadas</h3>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.occupiedUnits} / {stats.totalUnits}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Saldo Vencido</h3>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(stats.overdueBalance)}</div>
        </div>
      </div>
    </div>
  );
}
