import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { LayoutDashboard, Receipt, Calendar, Building, LogOut, Users, Diamond } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Reservations from './components/Reservations';
import Units from './components/Units';
import Residents from './components/Residents';
import Auth from './components/Auth';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: any) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const q = query(collection(db, 'users'), where('email', '==', currentUser.email));
          const querySnapshot = await getDocs(q);
          
          let hasAdminRole = false;
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            hasAdminRole = userData.role === 'admin';
          }
          
          // Grant admin if they have the admin role, or if they are the primary developer email
          setIsAdmin(hasAdminRole || currentUser.email === 'kennechu84@gmail.com');
        } catch (e) {
          console.error(e);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'transactions': return <Transactions isAdmin={isAdmin} />;
      case 'reservations': return <Reservations isAdmin={isAdmin} />;
      case 'units': return <Units isAdmin={isAdmin} />;
      case 'residents': return <Residents isAdmin={isAdmin} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Diamond className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Ribera Town Houses</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'transactions' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt size={20} />
            <span className="font-medium">Finanzas</span>
          </button>
          <button
            onClick={() => setActiveTab('reservations')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'reservations' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Calendar size={20} />
            <span className="font-medium">Reservaciones</span>
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'units' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Building size={20} />
            <span className="font-medium">Departamentos</span>
          </button>
          <button
            onClick={() => setActiveTab('residents')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'residents' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Users size={20} />
            <span className="font-medium">Residentes</span>
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Diamond className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Ribera Town Houses</span>
          </div>
          <button onClick={() => auth.signOut()} className="text-gray-500 p-2">
            <LogOut size={20} />
          </button>
        </div>
        
        {/* Mobile Navigation (Bottom) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
          <div className="flex justify-around p-2">
            <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl ${activeTab === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>
              <LayoutDashboard size={24} />
            </button>
            <button onClick={() => setActiveTab('transactions')} className={`p-3 rounded-xl ${activeTab === 'transactions' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>
              <Receipt size={24} />
            </button>
            <button onClick={() => setActiveTab('reservations')} className={`p-3 rounded-xl ${activeTab === 'reservations' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>
              <Calendar size={24} />
            </button>
            <button onClick={() => setActiveTab('units')} className={`p-3 rounded-xl ${activeTab === 'units' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>
              <Building size={24} />
            </button>
            <button onClick={() => setActiveTab('residents')} className={`p-3 rounded-xl ${activeTab === 'residents' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>
              <Users size={24} />
            </button>
          </div>
        </div>

        <main className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
