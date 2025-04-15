import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box, Table, Thead, Tbody, Tr, Th, Td, Checkbox, 
  Select, Button, Heading, VStack, HStack, Badge, 
  Text, useToast, Divider, Flex, Spinner,
  Menu, MenuButton, MenuList, MenuItem, IconButton,
  useBreakpointValue, Card, CardBody, Grid, 
  Stack, SimpleGrid, useDisclosure, Modal,
  ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalCloseButton
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

  // Check if mobile view should be used
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

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

  // Function to open user actions modal
  const handleUserAction = (userId) => {
    setSelectedUserId(userId);
    onOpen();
  };

  // Helper function to render house badge/selector
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
          _hover={{ borderColor: 'white' }}
          width={{ base: "130px", md: "160px" }}
          size={isMobile ? "sm" : "md"}
          fontSize={{ base: "xs", md: "sm" }}
        >
          {house.label}
        </MenuButton>
        <MenuList 
          zIndex={10} 
          maxH="300px" 
          overflowY="auto"
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
            >
              {house.label}
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    );
  };

  // Function to handle bulk house assignment
  const handleBulkHouseChange = async (house) => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No students selected',
        description: 'Please select students first',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    
    try {
      let successCount = 0;
      
      // Update each user one by one
      for (const userId of selectedUsers) {
        const success = await assignHouse(userId, house);
        if (success) successCount++;
      }
      
      toast({
        title: 'House updated',
        description: `Successfully assigned ${successCount} students to ${house}`,
        status: 'success',
        duration: 2000,
      });
      
      // Refresh users data
      fetchUsers();
      
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update houses',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Function to trigger test notifications
  const triggerTestNotifications = () => {
    // Set the flag to trigger test notifications in NotificationDisplay
    localStorage.setItem('testNotifications', 'true');
    
    toast({
      title: 'Test Notifications',
      description: 'Test notifications have been triggered',
      status: 'info',
      duration: 2000,
    });
    
    // Force refresh to trigger the useEffect in NotificationDisplay
    window.location.reload();
  };

  return (
    <Box className="admin-user-management" p={{ base: 2, md: 4 }}>
      <VStack spacing={4} align="stretch">
        {/* Header section, always visible but responsive */}
        <Stack 
          direction={{ base: "column", md: "row" }} 
          justify="space-between"
          spacing={{ base: 3, md: 0 }}
        >
          <Heading 
            size={{ base: "md", md: "lg" }} 
            className="highlight admin-title"
            textAlign={{ base: "center", md: "left" }}
          >
            Hogwarts Student Registry
          </Heading>
          <Stack 
            direction={{ base: "row", md: "row" }} 
            justify={{ base: "center", md: "flex-end" }}
            spacing={2}
            wrap="wrap"
          >
            <Badge colorScheme="purple" fontSize={{ base: "xs", md: "md" }} p={2}>Admin Console</Badge>
            <Button 
              colorScheme="purple" 
              size={{ base: "xs", md: "sm" }} 
              onClick={goToHousePoints}
            >
              House Points
            </Button>
            <Button 
              colorScheme="red" 
              size={{ base: "xs", md: "sm" }} 
              onClick={logout}
            >
              Logout
            </Button>
          </Stack>
        </Stack>
        
        <Divider />
        
        {/* Debug tools - only visible to admins */}
        <Flex direction="row" justify="flex-end" my={2}>
          <Button 
            size="xs" 
            colorScheme="cyan" 
            onClick={triggerTestNotifications}
            title="Trigger test notifications with all fields"
          >
            Test Notifications
          </Button>
        </Flex>
        
        {error && (
          <Box className="message-box error">
            <Text className="message-content">{error}</Text>
          </Box>
        )}
        
        {/* Control bar, responsive layout */}
        <Stack 
          direction={{ base: "column", md: "row" }} 
          justify="space-between" 
          align={{ base: "center", md: "center" }}
          spacing={3}
          className="admin-control-bar"
        >
          <Text fontSize={{ base: "sm", md: "md" }}>
            <strong>{selectedUsers.length}</strong> students selected
          </Text>
          
          {selectedUsers.length > 0 && (
            <Menu placement="bottom-end" strategy="fixed" closeOnSelect={true}>
              <MenuButton
                as={Button}
                colorScheme="yellow"
                size={{ base: "xs", md: "sm" }}
                mr={2}
              >
                Assign House
              </MenuButton>
              <MenuList zIndex={10} maxH="300px" overflowY="auto">
                {houses.map(house => (
                  <MenuItem 
                    key={house.value}
                    value={house.value}
                    onClick={() => handleBulkHouseChange(house.value)}
                    bg={house.bgColor}
                    color={house.textColor}
                    _hover={{ bg: `${house.bgColor}`, opacity: 0.8 }}
                    fontWeight="bold"
                  >
                    Assign to {house.label}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          )}
          
          <Flex 
            className="admin-actions" 
            wrap="wrap" 
            justify={{ base: "center", md: "flex-end" }}
            gap={2}
          >
            <Button 
              colorScheme="blue" 
              size={{ base: "xs", md: "sm" }} 
              onClick={handleResetPoints}
              isDisabled={selectedUsers.length === 0}
            >
              Reset Points
            </Button>
            <Button 
              colorScheme="green" 
              size={{ base: "xs", md: "sm" }} 
              onClick={handleResetAttempts}
              isDisabled={selectedUsers.length === 0}
            >
              Reset Attempts
            </Button>
            <Button 
              colorScheme="purple" 
              size={{ base: "xs", md: "sm" }} 
              onClick={handleForceSync}
              isDisabled={selectedUsers.length === 0}
            >
              Force Sync
            </Button>
            <Button 
              colorScheme="gray" 
              size={{ base: "xs", md: "sm" }} 
              onClick={fetchUsers}
            >
              Refresh
            </Button>
          </Flex>
        </Stack>
        
        <Box className="wizard-panel" p={{ base: 2, md: 4 }} borderRadius="md">
          {/* Desktop view: Table layout */}
          {!isMobile && (
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
                    <Th>House</Th>
                    <Th isNumeric>Points</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {loading ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center" className="admin-loading">
                        <Spinner size="lg" color="blue.500" />
                      </Td>
                    </Tr>
                  ) : users.length === 0 ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center">No students found</Td>
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
                        <Td>{renderHouseBadge(user)}</Td>
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
                            >
                              Reset Points
                            </Button>
                            <Button 
                              size="sm" 
                              colorScheme="blue"
                              onClick={() => resetAttemptsForUsers([user.id || user._id])}
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
          )}
          
          {/* Mobile view: Card layout */}
          {isMobile && (
            <Box width="100%">
              {loading ? (
                <Flex justify="center" align="center" minH="200px">
                  <Spinner size="xl" color="blue.500" />
                </Flex>
              ) : users.length === 0 ? (
                <Text textAlign="center" p={4}>No students found</Text>
              ) : (
                <SimpleGrid columns={1} spacing={4}>
                  {users.map(user => (
                    <Card key={user.id || user._id} variant="outline" className="wizard-panel">
                      <CardBody>
                        <Stack spacing={3}>
                          <Flex justify="space-between" align="center">
                            <Checkbox 
                              isChecked={selectedUsers.includes(user.id || user._id)}
                              onChange={() => toggleUserSelection(user.id || user._id)}
                              mr={2}
                            />
                            <Text fontWeight="bold" fontSize="lg">{user.username}</Text>
                            <Badge 
                              colorScheme={user.magicPoints >= 100 ? 'green' : user.magicPoints >= 50 ? 'yellow' : 'red'}
                              fontSize="md"
                              p={2}
                            >
                              {user.magicPoints} pts
                            </Badge>
                          </Flex>
                          
                          <Flex justify="space-between" align="center">
                            {renderHouseBadge(user)}
                            <Button 
                              size="sm" 
                              colorScheme="purple"
                              onClick={() => handleUserAction(user.id || user._id)}
                            >
                              Actions
                            </Button>
                          </Flex>
                        </Stack>
                      </CardBody>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Box>
          )}
        </Box>
      </VStack>
      
      {/* Mobile User Actions Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent className="wizard-panel">
          <ModalHeader>Student Actions</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Button 
                colorScheme="green" 
                size="md" 
                width="100%"
                onClick={() => {
                  if (selectedUserId) {
                    resetPointsForUsers([selectedUserId]);
                    onClose();
                  }
                }}
              >
                Reset Points
              </Button>
              <Button 
                colorScheme="blue" 
                size="md" 
                width="100%"
                onClick={() => {
                  if (selectedUserId) {
                    resetAttemptsForUsers([selectedUserId]);
                    onClose();
                  }
                }}
              >
                Reset Attempts
              </Button>
              <Button 
                colorScheme="purple" 
                size="md" 
                width="100%"
                onClick={() => {
                  if (selectedUserId) {
                    forceSyncForUsers([selectedUserId]);
                    onClose();
                  }
                }}
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