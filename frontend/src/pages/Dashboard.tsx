import { useProfile } from '@/contexts/ProfileContext';
import { CoordinatorDashboard } from '@/components/dashboard/CoordinatorDashboard';
import { MentorDashboard } from '@/components/dashboard/MentorDashboard';
import { ProducerDashboard } from '@/components/dashboard/ProducerDashboard';

const Dashboard = () => {
  const { profile } = useProfile();

  switch (profile) {
    case 'mentor':
    case 'mentor_produtor':
      return <MentorDashboard />;
    case 'produtor':
      return <ProducerDashboard />;
    default:
      return <CoordinatorDashboard />;
  }
};

export default Dashboard;
