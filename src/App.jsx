import { ActivityStateProvider } from './context/ActivityStateContext';
import MagicPointsDebug from './components/MagicPointsDebug';
import UserSyncManager from './components/UserSyncManager';
import { ChakraProvider, theme } from '@chakra-ui/react';
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter as Router } from 'react-router-dom';
// ...existing imports...

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <Router>
          <ActivityStateProvider>
            <UserSyncManager />
            {/* Your existing app content */}
            <MagicPointsDebug />
          </ActivityStateProvider>
        </Router>
      </AuthProvider>
    </ChakraProvider>
  );
}

export default App;
