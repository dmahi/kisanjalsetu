import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { BottomNav, RequireAuth, RequireRole, roleHomePath } from './navigation';

import PhoneLogin from './screens/auth/PhoneLogin';
import OtpVerify from './screens/auth/OtpVerify';

import FarmerHome from './screens/farmer/FarmerHome';
import FarmerSessions from './screens/farmer/FarmerSessions';
import FarmerPayments from './screens/farmer/FarmerPayments';
import FarmerTubewells from './screens/farmer/FarmerTubewells';
import FarmerTubewellDetail from './screens/farmer/FarmerTubewellDetail';
import FarmerMyTubewellDetail from './screens/farmer/FarmerMyTubewellDetail';
import FarmerProfile from './screens/farmer/FarmerProfile';
import BecomeOwner from './screens/farmer/BecomeOwner';
import FarmerWaterRequests from './screens/farmer/FarmerWaterRequests';

import OwnerDashboard from './screens/owner/OwnerDashboard';
import OwnerCustomers from './screens/owner/OwnerCustomers';
import OwnerCustomerDetail from './screens/owner/OwnerCustomerDetail';
import OwnerSessions from './screens/owner/OwnerSessions';
import OwnerPayments from './screens/owner/OwnerPayments';
import OwnerReports from './screens/owner/OwnerReports';
import OwnerProfile from './screens/owner/OwnerProfile';
import OwnerWaterQueue from './screens/owner/OwnerWaterQueue';

import NotificationsScreen from './screens/shared/NotificationsScreen';

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/login" replace />;
  return <Navigate to={roleHomePath(user.role)} replace />;
}

export function AppRoutes() {
  const user = useAuthStore((s) => s.user);
  return (
    <>
      <Routes>
        <Route path="/login" element={<PhoneLogin />} />
        <Route path="/login/otp" element={<OtpVerify />} />
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/farmer/*"
          element={
            <RequireAuth>
              <RequireRole roles={['farmer']}>
                <FarmerRoutes />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/owner/*"
          element={
            <RequireAuth>
              <RequireRole roles={['tubewell_owner', 'operator']}>
                <OwnerRoutes />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={user ? (user.role === 'admin' ? <Navigate to="/login" replace /> : <Navigate to={roleHomePath(user.role)} replace />) : <Navigate to="/login" replace />}
        />
      </Routes>
      <BottomNav />
    </>
  );
}

function FarmerRoutes() {
  return (
    <Routes>
      <Route path="home" element={<FarmerHome />} />
      <Route path="tubewells" element={<FarmerTubewells />} />
      <Route path="tubewells/:id" element={<FarmerTubewellDetail />} />
      <Route path="my-tubewells/:id" element={<FarmerMyTubewellDetail />} />
      <Route path="requests" element={<FarmerWaterRequests />} />
      <Route path="sessions" element={<FarmerSessions />} />
      <Route path="payments" element={<FarmerPayments />} />
      <Route path="profile" element={<FarmerProfile />} />
      <Route path="become-owner" element={<BecomeOwner />} />
      <Route path="notifications" element={<NotificationsScreen title="Notifications" backTo="/farmer/profile" />} />
      <Route path="*" element={<Navigate to="/farmer/home" replace />} />
    </Routes>
  );
}

function OwnerRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<OwnerDashboard />} />
      <Route path="queue" element={<OwnerWaterQueue />} />
      <Route path="customers" element={<OwnerCustomers />} />
      <Route path="customers/:customerId" element={<OwnerCustomerDetail />} />
      <Route path="sessions" element={<OwnerSessions />} />
      <Route path="payments" element={<OwnerPayments />} />
      <Route path="reports" element={<OwnerReports />} />
      <Route path="profile" element={<OwnerProfile />} />
      <Route path="notifications" element={<NotificationsScreen title="Notifications" backTo="/owner/profile" />} />
      <Route path="*" element={<Navigate to="/owner/dashboard" replace />} />
    </Routes>
  );
}