import { ActivityStateProvider } from './context/ActivityStateContext';
import MagicPointsDebug from './components/MagicPointsDebug';
// ...existing imports...

function App() {
  return (
    <ActivityStateProvider>
      {/* Your existing app content */}
      <MagicPointsDebug />
    </ActivityStateProvider>
  );
}

export default App;
