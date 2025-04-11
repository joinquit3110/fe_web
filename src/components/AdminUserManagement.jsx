import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Checkbox, 
  Select, Button, Heading, VStack, HStack, Badge, 
  Text, useToast, Divider, Flex, Spinner,
  Menu, MenuButton, MenuList, MenuItem, IconButton
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
  
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Houses options
  const houses = [
    { value: 'gryffindor', label: 'Gryffindor', color: 'red.500', bgColor: '#740001', textColor: '#FFC500' },
    { value: 'slytherin', label: 'Slytherin', color: 'green.500', bgColor: '#1A472A', textColor: '#AAAAAA' },
    { value: 'ravenclaw', label: 'Ravenclaw', color: 'blue.500', bgColor: '#0E1A40', textColor: '#946B2D' },
    { value: 'hufflepuff', label: 'Hufflepuff', color: 'yellow.500', bgColor: '#ecb939', textColor: '#000000' },
    { value: 'muggle', label: 'Muggle', color: 'gray.500', bgColor: '#6B6B6B', textColor: '#FFFFFF' },
    { value: 'admin', label: 'Admin', color: 'purple.500', bgColor: '#4B0082', textColor: '#FFFFFF' }
  ];

  // Fetch users once on component mount instead of auto-refresh
  useEffect(() => {
    // Load users once when component mounts
    fetchUsers();
    
    // Remove auto-refresh - it was causing problems
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [fetchUsers]);

  // Handle house change with better error handling and validation
  const handleHouseChange = async (userId, house) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'Cannot update: User ID is missing',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    console.log(`Attempting to assign ${house} to user ${userId}`);
    
    try {
      const success = await assignHouse(userId, house);
      
      if (success) {
        toast({
          title: 'House updated',
          description: `Successfully assigned to ${house}`,
          status: 'success',
          duration: 2000,
        });
        
        // Manually update UI to reflect the change immediately
        const updatedUsers = users.map(user => 
          user.id === userId ? { ...user, house: house } : user
        );
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

  // Navigate to house points page
  const goToHousePoints = () => {
    navigate('/admin/house-points');
  };

  return (
    <Box className="admin-user-management">
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg" className="highlight admin-title">Hogwarts Student Registry</Heading>
          <HStack>
            <Badge colorScheme="purple" fontSize="md" p={2}>Admin Console</Badge>
            <Button 
              colorScheme="purple" 
              size="sm" 
              onClick={goToHousePoints}
              mr={2}
            >
              House Points
            </Button>
            <Button colorScheme="red" size="sm" onClick={logout}>Logout</Button>
          </HStack>
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
          <Box overflowX="auto" width="100%">
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
                  <Th>ID</Th>
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
                    <Tr key={user.id || user._id}>
                      <Td>
                        <Checkbox 
                          isChecked={selectedUsers.includes(user.id || user._id)}
                          onChange={() => toggleUserSelection(user.id || user._id)}
                        />
                      </Td>
                      <Td>{user.username}</Td>
                      <Td><Text fontSize="xs" color="gray.400">{user.id || user._id}</Text></Td>
                      <Td>
                        <Menu>
                          <MenuButton 
                            as={Button}
                            bg={houses.find(h => h.value === user.house)?.bgColor || 'gray.700'}
                            color={houses.find(h => h.value === user.house)?.textColor || 'white'}
                            fontWeight="bold"
                            borderWidth="2px"
                            borderColor={houses.find(h => h.value === user.house)?.color || 'gray.500'}
                            _hover={{ borderColor: 'white' }}
                            width="160px"
                          >
                            {user.house ? houses.find(h => h.value === user.house)?.label : 'Select House'}
                          </MenuButton>
                          <MenuList>
                            {houses.map(house => (
                              <MenuItem 
                                key={house.value}
                                value={house.value}
                                onClick={() => handleHouseChange(user.id || user._id, house.value)}
                                bg={house.bgColor}
                                color={house.textColor}
                                _hover={{ bg: 'gray.600' }}
                              >
                                {house.label}
                              </MenuItem>
                            ))}
                          </MenuList>
                        </Menu>
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
                            onClick={() => resetPointsForUsers([user.id || user._id])}
                            fontSize={{base: "10px", md: "12px"}}
                            p={{base: "4px 6px", md: "6px 10px"}}
                          >
                            Reset Points
                          </Button>
                          <Button 
                            size="sm" 
                            colorScheme="blue"
                            onClick={() => resetAttemptsForUsers([user.id || user._id])}
                            fontSize={{base: "10px", md: "12px"}}
                            p={{base: "4px 6px", md: "6px 10px"}}
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
        </Box>
      </VStack>
    </Box>
  );
};

export default AdminUserManagement; 