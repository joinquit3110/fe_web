import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Checkbox, 
  Select, Button, Heading, VStack, HStack, Badge, 
  Text, useToast, Divider, Flex, Spinner
} from '@chakra-ui/react';
import '../styles/Admin.css'; // Import admin styles

const AdminUserManagement = () => {
  const { 
    users, 
    selectedUsers, 
    loading, 
    error,
    fetchUsers,
    assignHouse,
    toggleUserSelection,
    selectAllUsers,
    resetPointsForUsers,
    resetAttemptsForUsers,
    forceSyncForUsers
  } = useAdmin();
  
  const toast = useToast();
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Houses options
  const houses = [
    { value: 'gryffindor', label: 'Gryffindor', color: 'red.500' },
    { value: 'slytherin', label: 'Slytherin', color: 'green.500' },
    { value: 'ravenclaw', label: 'Ravenclaw', color: 'blue.500' },
    { value: 'hufflepuff', label: 'Hufflepuff', color: 'yellow.500' }
  ];

  // Start auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers();
    }, 5000); // Refresh every 5 seconds
    
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [fetchUsers]);

  // Handle house change
  const handleHouseChange = async (userId, house) => {
    try {
      const success = await assignHouse(userId, house);
      
      if (success) {
        toast({
          title: 'House updated',
          status: 'success',
          duration: 2000,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update house',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Handle reset points
  const handleResetPoints = async () => {
    try {
      const success = await resetPointsForUsers();
      
      if (success) {
        toast({
          title: 'Points reset',
          description: `Reset points for ${selectedUsers.length} users`,
          status: 'success',
          duration: 2000,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset points',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Handle reset attempts
  const handleResetAttempts = async () => {
    try {
      const success = await resetAttemptsForUsers();
      
      if (success) {
        toast({
          title: 'Attempts reset',
          description: `Reset attempts for ${selectedUsers.length} users`,
          status: 'success',
          duration: 2000,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset attempts',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Handle force sync
  const handleForceSync = async () => {
    try {
      const success = await forceSyncForUsers();
      
      if (success) {
        toast({
          title: 'Sync completed',
          description: `Synced data for ${selectedUsers.length} users`,
          status: 'success',
          duration: 2000,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to sync',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <Box className="admin-user-management">
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg" className="highlight admin-title">Hogwarts Student Registry</Heading>
          <Badge colorScheme="purple" fontSize="md" p={2}>Admin Console</Badge>
        </HStack>
        
        <Divider />
        
        {error && (
          <Box className="message-box error">
            <Text className="message-content">{error}</Text>
          </Box>
        )}
        
        <HStack justify="space-between" className="admin-control-bar">
          <Text>{selectedUsers.length} students selected</Text>
          <HStack className="admin-actions">
            <Button 
              colorScheme="blue" 
              size="sm" 
              onClick={handleResetPoints}
              isDisabled={selectedUsers.length === 0}
            >
              Reset Points
            </Button>
            <Button 
              colorScheme="green" 
              size="sm" 
              onClick={handleResetAttempts}
              isDisabled={selectedUsers.length === 0}
            >
              Reset Attempts
            </Button>
            <Button 
              colorScheme="purple" 
              size="sm" 
              onClick={handleForceSync}
              isDisabled={selectedUsers.length === 0}
            >
              Force Sync
            </Button>
            <Button 
              colorScheme="gray" 
              size="sm" 
              onClick={fetchUsers}
            >
              Refresh Data
            </Button>
          </HStack>
        </HStack>
        
        <Box className="wizard-panel" p={4} borderRadius="md">
          <Table variant="simple" className="admin-table">
            <Thead>
              <Tr>
                <Th width="50px">
                  <Checkbox 
                    isChecked={selectedUsers.length > 0 && selectedUsers.length === users.length} 
                    isIndeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
                    onChange={selectAllUsers}
                  />
                </Th>
                <Th>Wizard Name</Th>
                <Th>Email</Th>
                <Th>House</Th>
                <Th isNumeric>Magic Points</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={6} textAlign="center" className="admin-loading">
                    <Spinner size="lg" color="blue.500" />
                  </Td>
                </Tr>
              ) : users.length === 0 ? (
                <Tr>
                  <Td colSpan={6} textAlign="center">No students found</Td>
                </Tr>
              ) : (
                users.map(user => (
                  <Tr key={user.id}>
                    <Td>
                      <Checkbox 
                        isChecked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                      />
                    </Td>
                    <Td>{user.username}</Td>
                    <Td>{user.email}</Td>
                    <Td>
                      <Select 
                        value={user.house || ''}
                        onChange={(e) => handleHouseChange(user.id, e.target.value)}
                        bg={houses.find(h => h.value === user.house)?.color || 'gray.700'}
                        color="white"
                        fontWeight="bold"
                        className="admin-house-select"
                      >
                        {houses.map(house => (
                          <option key={house.value} value={house.value}>
                            {house.label}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td isNumeric>
                      <Badge 
                        colorScheme={user.magicPoints >= 100 ? 'green' : user.magicPoints >= 50 ? 'yellow' : 'red'}
                        fontSize="md"
                        p={2}
                        className="admin-badge"
                      >
                        {user.magicPoints}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack className="admin-actions">
                        <Button 
                          size="sm" 
                          colorScheme="green"
                          onClick={() => resetPointsForUsers([user.id])}
                        >
                          Reset Points
                        </Button>
                        <Button 
                          size="sm" 
                          colorScheme="blue"
                          onClick={() => resetAttemptsForUsers([user.id])}
                        >
                          Reset Attempts
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </VStack>
    </Box>
  );
};

export default AdminUserManagement; 