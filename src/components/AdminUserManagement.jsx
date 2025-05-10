import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Checkbox, 
  Select, Button, Heading, VStack, HStack, Badge, 
  Text, useToast, Divider, Flex, Spinner,
  Menu, MenuButton, MenuList, MenuItem,
  useBreakpointValue, Card, CardBody, 
  Stack, SimpleGrid, useDisclosure, Modal,
  ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton, Tooltip
} from '@chakra-ui/react';
import '../styles/Admin.css';

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
    forceSyncForUsers,
    isAdmin
  } = useAdmin();
  
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  const houses = [
    { value: 'gryffindor', label: 'Gryffindor', color: 'red.500', bgColor: '#740001', textColor: '#FFC500' },
    { value: 'slytherin', label: 'Slytherin', color: 'green.500', bgColor: '#1A472A', textColor: '#AAAAAA' },
    { value: 'ravenclaw', label: 'Ravenclaw', color: 'blue.500', bgColor: '#0E1A40', textColor: '#946B2D' },
    { value: 'hufflepuff', label: 'Hufflepuff', color: 'yellow.500', bgColor: '#ecb939', textColor: '#000000' },
    { value: 'muggle', label: 'Muggle', color: 'gray.500', bgColor: '#6B6B6B', textColor: '#FFFFFF' },
    { value: 'admin', label: 'Admin', color: 'purple.500', bgColor: '#4B0082', textColor: '#FFFFFF' }
  ];

  const isMobile = useBreakpointValue({ base: true, md: false });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  useEffect(() => {
    fetchUsers();
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [fetchUsers]);

  useEffect(() => {
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        fetchUsers();
      }, 30000);
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefreshEnabled, fetchUsers]);

  const handleHouseChange = async (userId, house) => {
    try {
      const success = await assignHouse(userId, house);
      
      if (success) {
        toast({
          title: 'House updated',
          description: `Successfully assigned user to ${house}`,
          status: 'success',
          duration: 2000,
          isClosable: true,
          position: 'top-right'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update house',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    }
  };

  const goToHousePoints = () => {
    navigate('/admin/house-points');
  };

  const handleResetPoints = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No students selected',
        description: 'Please select students first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
      return;
    }
    
    try {
      const success = await resetPointsForUsers(selectedUsers);
      
      if (success) {
        toast({
          title: 'Points reset',
          description: `Successfully reset points for ${selectedUsers.length} students`,
          status: 'success',
          duration: 2000,
          isClosable: true,
          position: 'top-right'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset points',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    }
  };

  const handleResetAttempts = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No students selected',
        description: 'Please select students first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
      return;
    }
    
    try {
      const success = await resetAttemptsForUsers(selectedUsers);
      
      if (success) {
        toast({
          title: 'Attempts reset',
          description: `Successfully reset attempts for ${selectedUsers.length} students`,
          status: 'success',
          duration: 2000,
          isClosable: true,
          position: 'top-right'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset attempts',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    }
  };
  
  const handleForceSync = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No students selected',
        description: 'Please select students first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
      return;
    }
    
    try {
      const success = await forceSyncForUsers(selectedUsers);
      
      if (success) {
        toast({
          title: 'Force sync complete',
          description: `Successfully synchronized ${selectedUsers.length} students`,
          status: 'success',
          duration: 2000,
          isClosable: true,
          position: 'top-right'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to force sync',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    }
  };

  const renderHouseBadge = (user) => {
    const house = houses.find(h => h.value === user.house) || 
      { value: 'unknown', label: 'Unknown', bgColor: 'gray.700', textColor: 'white', color: 'gray.500' };
    
    return (
      <Menu placement="bottom" strategy="fixed" closeOnSelect={true}>
        <MenuButton 
          as={Button}
          bg={house.bgColor}
          color={house.textColor}
          fontWeight="bold"
          borderWidth="2px"
          borderColor={house.color}
          width={{ base: "130px", md: "160px" }}
          size={isMobile ? "sm" : "md"}
          fontSize={{ base: "xs", md: "sm" }}
          className={`house-badge ${house.value}`}
        >
          {house.label}
        </MenuButton>
        <MenuList 
          zIndex={10} 
          maxH="300px" 
          overflowY="auto"
          className="admin-menu-list"
        >
          {houses.map(house => (
            <MenuItem 
              key={house.value}
              value={house.value}
              onClick={() => handleHouseChange(user.id || user._id, house.value)}
              bg={house.bgColor}
              color={house.textColor}
              _hover={{ bg: `${house.bgColor}`, opacity: 0.8 }}
              fontWeight="bold"
              className="admin-menu-item"
            >
              {house.label}
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    );
  };

  const handleBulkHouseChange = async (house) => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No students selected',
        description: 'Please select students first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
      return;
    }
    
    try {
      let successCount = 0;
      
      for (const userId of selectedUsers) {
        const success = await assignHouse(userId, house);
        if (success) successCount++;
      }
      
      toast({
        title: 'House updated',
        description: `Successfully assigned ${successCount} students to ${house}`,
        status: 'success',
        duration: 2000,
        isClosable: true,
        position: 'top-right'
      });
      
      fetchUsers();
      
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update houses',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right'
      });
    }
  };

  const triggerTestNotifications = () => {
    localStorage.setItem('testNotifications', 'true');
    
    toast({
      title: 'Test Notifications',
      description: 'Test notifications have been triggered',
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'top-right'
    });
    
    window.location.reload();
  };

  const handleUserAction = (userId) => {
    setSelectedUserId(userId);
    onOpen();
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = React.useMemo(() => {
    if (!sortConfig.key) return users;
    
    return [...users].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'magicPoints') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [users, sortConfig]);
  
  if (!isAdmin) {
    return null;
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'ascending' ? '↑' : '↓';
  };

  return (
    <Box className="admin-container">
      <VStack spacing={4} align="stretch">
        <Stack 
          direction={{ base: "column", md: "row" }} 
          justify="space-between"
          spacing={{ base: 3, md: 0 }}
          className="admin-header"
        >
          <Heading 
            className="admin-title"
            textAlign={{ base: "center", md: "left" }}
          >
            Hogwarts Student Registry
          </Heading>
          <Stack 
            direction={{ base: "row" }} 
            justify={{ base: "center", md: "flex-end" }}
            spacing={2}
            wrap="wrap"
            className="admin-nav"
          >
            <Badge className="admin-badge">Admin Console</Badge>
            <Button 
              onClick={goToHousePoints}
              className="admin-button primary"
            >
              House Points
            </Button>
            <Button 
              onClick={logout}
              className="admin-button danger"
            >
              Logout
            </Button>
          </Stack>
        </Stack>
        
        <Divider className="admin-divider" />
        
        <Flex direction="row" justify="space-between" align="center" my={2} className="admin-tool-bar">
          <Box>
            <Tooltip label={autoRefreshEnabled ? "Disable auto refresh" : "Enable auto refresh (30s)"} placement="top">
              <Button 
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`admin-button ${autoRefreshEnabled ? 'success' : 'secondary'}`}
                size="sm"
              >
                {autoRefreshEnabled ? 'Auto Refresh: ON' : 'Auto Refresh: OFF'}
              </Button>
            </Tooltip>
          </Box>
          <Box>
            <Tooltip label="Trigger test notifications for debugging" placement="top">
              <Button 
                onClick={triggerTestNotifications}
                className="admin-button info"
                size="sm"
              >
                Test Notifications
              </Button>
            </Tooltip>
          </Box>
        </Flex>
        
        {error && (
          <Box className="admin-message-box error">
            <Text>{error}</Text>
            <Button 
              onClick={fetchUsers} 
              className="admin-button primary"
              size="sm"
              ml={2}
            >
              Try Again
            </Button>
          </Box>
        )}
        
        <Box className="admin-control-bar">
          <Text className="admin-text">
            <strong className="admin-highlight">{selectedUsers.length}</strong> students selected
          </Text>
          
          {selectedUsers.length > 0 ? (
            <Menu placement="bottom-end" strategy="fixed" closeOnSelect={true}>
              <MenuButton
                as={Button}
                className="admin-button secondary"
                size="sm"
              >
                Assign House
              </MenuButton>
              <MenuList zIndex={10} maxH="300px" overflowY="auto" className="admin-menu-list">
                {houses.map(house => (
                  <MenuItem 
                    key={house.value}
                    value={house.value}
                    onClick={() => handleBulkHouseChange(house.value)}
                    bg={house.bgColor}
                    color={house.textColor}
                    _hover={{ bg: `${house.bgColor}`, opacity: 0.8 }}
                    fontWeight="bold"
                    className="admin-menu-item"
                  >
                    Assign to {house.label}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          ) : (
            <Button 
              className="admin-button secondary"
              size="sm"
              isDisabled={true}
            >
              Assign House
            </Button>
          )}
          
          <div className="admin-actions">
            <Tooltip label={selectedUsers.length === 0 ? "Select students first" : "Reset points to 100 for selected students"}>
              <Button 
                onClick={handleResetPoints}
                isDisabled={selectedUsers.length === 0}
                className="admin-button success"
                size="sm"
              >
                Reset Points
              </Button>
            </Tooltip>
            <Tooltip label={selectedUsers.length === 0 ? "Select students first" : "Reset activity attempts for selected students"}>
              <Button 
                onClick={handleResetAttempts}
                isDisabled={selectedUsers.length === 0}
                className="admin-button info"
                size="sm"
              >
                Reset Attempts
              </Button>
            </Tooltip>
            <Tooltip label={selectedUsers.length === 0 ? "Select students first" : "Force sync data for selected students"}>
              <Button 
                onClick={handleForceSync}
                isDisabled={selectedUsers.length === 0}
                className="admin-button secondary"
                size="sm"
              >
                Force Sync
              </Button>
            </Tooltip>
            <Tooltip label="Refresh student data">
              <Button 
                onClick={fetchUsers}
                className="admin-button primary"
                size="sm"
              >
                Refresh
              </Button>
            </Tooltip>
          </div>
        </Box>
        
        <Box className="admin-panel">
          {!isMobile && (
            <Box className="admin-table-container">
              <Table variant="simple" className="admin-table">
                <Thead>
                  <Tr className="admin-table-header">
                    <Th width="50px" className="admin-th">
                      <Checkbox 
                        isChecked={selectedUsers.length > 0 && selectedUsers.length === users.length} 
                        isIndeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
                        onChange={selectAllUsers}
                        colorScheme="yellow"
                        className="admin-checkbox"
                      />
                    </Th>
                    <Th className="admin-th sortable" onClick={() => requestSort('username')}>
                      Wizard Name {getSortIcon('username')}
                    </Th>
                    <Th className="admin-th">House</Th>
                    <Th isNumeric className="admin-th sortable" onClick={() => requestSort('magicPoints')}>
                      Points {getSortIcon('magicPoints')}
                    </Th>
                    <Th className="admin-th">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {loading ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center">
                        <div className="admin-loading">
                          <div className="admin-loading-spinner"></div>
                        </div>
                      </Td>
                    </Tr>
                  ) : sortedUsers.length === 0 ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center" className="admin-empty-state">No students found</Td>
                    </Tr>
                  ) : (
                    sortedUsers.map(user => (
                      <Tr key={user.id || user._id} className="admin-table-row">
                        <Td className="admin-td">
                          <Checkbox 
                            isChecked={selectedUsers.includes(user.id || user._id)}
                            onChange={() => toggleUserSelection(user.id || user._id)}
                            colorScheme="yellow"
                            className="admin-checkbox"
                          />
                        </Td>
                        <Td className="admin-td">{user.username}</Td>
                        <Td className="admin-td">{renderHouseBadge(user)}</Td>
                        <Td isNumeric className="admin-td">
                          <Badge 
                            colorScheme={user.magicPoints >= 100 ? 'green' : user.magicPoints >= 50 ? 'yellow' : 'red'}
                            className={`admin-badge ${user.magicPoints >= 100 ? 'success' : user.magicPoints >= 50 ? 'warning' : 'danger'}`}
                          >
                            {user.magicPoints || 0}
                          </Badge>
                        </Td>
                        <Td className="admin-td">
                          <Box className="admin-actions">
                            <Tooltip label="Reset points to 100">
                              <Button 
                                onClick={() => resetPointsForUsers([user.id || user._id])}
                                className="admin-button success"
                                size="sm"
                              >
                                Reset Points
                              </Button>
                            </Tooltip>
                            <Tooltip label="Reset activity attempts">
                              <Button 
                                onClick={() => resetAttemptsForUsers([user.id || user._id])}
                                className="admin-button info"
                                size="sm"
                              >
                                Reset Attempts
                              </Button>
                            </Tooltip>
                            <Tooltip label="Force data synchronization">
                              <Button 
                                onClick={() => forceSyncForUsers([user.id || user._id])}
                                className="admin-button secondary"
                                size="sm"
                              >
                                Force Sync
                              </Button>
                            </Tooltip>
                          </Box>
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Box>
          )}
          
          {isMobile && (
            <Box width="100%" className="admin-cards-container">
              {loading ? (
                <div className="admin-loading">
                  <div className="admin-loading-spinner"></div>
                </div>
              ) : sortedUsers.length === 0 ? (
                <Text textAlign="center" p={4} className="admin-empty-state">No students found</Text>
              ) : (
                <SimpleGrid columns={1} spacing={4}>
                  {sortedUsers.map(user => (
                    <Box key={user.id || user._id} className="admin-card">
                      <Box className="admin-card-header">
                        <Flex justify="space-between" align="center">
                          <Checkbox 
                            isChecked={selectedUsers.includes(user.id || user._id)}
                            onChange={() => toggleUserSelection(user.id || user._id)}
                            colorScheme="yellow"
                            className="admin-checkbox"
                            mr={2}
                          />
                          <Text fontWeight="bold" fontSize="lg" className="admin-card-title">{user.username}</Text>
                          <Badge 
                            colorScheme={user.magicPoints >= 100 ? 'green' : user.magicPoints >= 50 ? 'yellow' : 'red'}
                            className={`admin-badge ${user.magicPoints >= 100 ? 'success' : user.magicPoints >= 50 ? 'warning' : 'danger'}`}
                          >
                            {user.magicPoints || 0} pts
                          </Badge>
                        </Flex>
                      </Box>
                      
                      <Box className="admin-card-body">
                        <Flex justify="space-between" align="center">
                          {renderHouseBadge(user)}
                          <Button 
                            onClick={() => handleUserAction(user.id || user._id)}
                            className="admin-button primary"
                            size="sm"
                          >
                            Actions
                          </Button>
                        </Flex>
                      </Box>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Box>
          )}
        </Box>
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent className="admin-modal">
          <ModalHeader className="admin-modal-header">Student Actions</ModalHeader>
          <ModalCloseButton className="admin-modal-close" />
          <ModalBody pb={6} className="admin-modal-body">
            <VStack spacing={4}>
              <Button 
                onClick={() => {
                  if (selectedUserId) {
                    resetPointsForUsers([selectedUserId]);
                    onClose();
                  }
                }}
                className="admin-button success"
                width="100%"
              >
                Reset Points
              </Button>
              <Button 
                onClick={() => {
                  if (selectedUserId) {
                    resetAttemptsForUsers([selectedUserId]);
                    onClose();
                  }
                }}
                className="admin-button info"
                width="100%"
              >
                Reset Attempts
              </Button>
              <Button 
                onClick={() => {
                  if (selectedUserId) {
                    forceSyncForUsers([selectedUserId]);
                    onClose();
                  }
                }}
                className="admin-button secondary"
                width="100%"
              >
                Force Sync
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminUserManagement;