import { ActivityStateProvider } from './context/ActivityStateContext';
import MagicPointsDebug from './components/MagicPointsDebug';
import NotificationDisplay from './components/NotificationDisplay'; // Import NotificationDisplay
// ...existing imports...

function App() {
  return (
    <ActivityStateProvider>
      {/* Your existing app content */}
      <NotificationDisplay /> {/* Render NotificationDisplay */}
      <MagicPointsDebug />
    </ActivityStateProvider>
  );
}

export default App;
