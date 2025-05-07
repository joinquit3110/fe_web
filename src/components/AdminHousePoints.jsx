import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Heading, VStack, HStack, Badge, 
  Text, useToast, Divider, Flex, Spinner,
  Tabs, TabList, TabPanels, Tab, TabPanel,
  FormControl, FormLabel, Select, Input, Textarea,
  Radio, RadioGroup, Stack, SimpleGrid
} from '@chakra-ui/react';
import '../styles/Admin.css';

const AdminHousePoints = () => {
  const { 
    isAdmin,
    updateHousePoints,
    updateGroupCriteriaPoints,
    criteriaPoints,
    loading: contextLoading,
    error,
    fetchUsers,
    forceSyncForUsers,
    users
  } = useAdmin();
  
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Individual loading states for each type of button
  const [buttonLoading, setButtonLoading] = useState({
    gryffindor10: false,
    gryffindor20: false,
    gryffindor50: false,
    gryffindorMinus: false,
    slytherin10: false,
    slytherin20: false,
    slytherin50: false,
    slytherinMinus: false,
    ravenclaw10: false,
    ravenclaw20: false,
    ravenclaw50: false,
    ravenclawMinus: false,
    hufflepuff10: false,
    hufflepuff20: false,
    hufflepuff50: false,
    hufflepuffMinus: false,
    customPoints: false
  });

  const [localLoading, setLocalLoading] = useState(false);
  const loading = localLoading || contextLoading;
  
  const [houseStats, setHouseStats] = useState({
    gryffindor: 0,
    slytherin: 0,
    ravenclaw: 0,
    hufflepuff: 0
  });
  
  const [houseAverages, setHouseAverages] = useState({
    gryffindor: 0,
    slytherin: 0,
    ravenclaw: 0,
    hufflepuff: 0
  });
  
  const [selectedHouse, setSelectedHouse] = useState('gryffindor');
  const [reason, setReason] = useState('');
  
  const [groupHouse, setGroupHouse] = useState('gryffindor');
  const [criteriaType, setCriteriaType] = useState('participation');
  const [performanceLevel, setPerformanceLevel] = useState('satisfactory');
  const [details, setDetails] = useState('');
  
  const houses = [
    { value: 'gryffindor', label: 'Gryffindor', color: 'red.500', bgColor: '#740001', textColor: '#FFC500' },
    { value: 'slytherin', label: 'Slytherin', color: 'green.500', bgColor: '#1A472A', textColor: '#AAAAAA' },
    { value: 'ravenclaw', label: 'Ravenclaw', color: 'blue.500', bgColor: '#0E1A40', textColor: '#946B2D' },
    { value: 'hufflepuff', label: 'Hufflepuff', color: 'yellow.500', bgColor: '#ecb939', textColor: '#000000' }
  ];
  
  const criteriaTypes = [
    { value: 'participation', label: 'Level of participation of group members' },
    { value: 'english', label: 'Level of English usage in the group' },
    { value: 'completion', label: 'Time taken by the group to complete tasks' }
  ];
  
  const performanceLevels = [
    { value: 'excellent', label: 'Excellent', points: criteriaPoints.excellent },
    { value: 'good', label: 'Good', points: criteriaPoints.good },
    { value: 'satisfactory', label: 'Satisfactory', points: criteriaPoints.satisfactory },
    { value: 'poor', label: 'Poor', points: criteriaPoints.poor },
    { value: 'veryPoor', label: 'Very Poor', points: criteriaPoints.veryPoor }
  ];
  
  useEffect(() => {
    const refreshData = async () => {
      await fetchUsers();
      calculateHouseAverages();
    };
    
    refreshData();
  }, [fetchUsers]);
  
  const calculateHouseAverages = () => {
    if (!users || users.length === 0) return;
    
    const houseData = {
      gryffindor: { total: 0, count: 0 },
      slytherin: { total: 0, count: 0 },
      ravenclaw: { total: 0, count: 0 },
      hufflepuff: { total: 0, count: 0 }
    };
    
    users.forEach(user => {
      const house = user.house;
      if (!house || !houseData[house]) return;
      
      const points = user.magicPoints || 0;
      houseData[house].total += points;
      houseData[house].count++;
    });
    
    const averages = {
      gryffindor: houseData.gryffindor.count ? Math.round(houseData.gryffindor.total / houseData.gryffindor.count) : 0,
      slytherin: houseData.slytherin.count ? Math.round(houseData.slytherin.total / houseData.slytherin.count) : 0,
      ravenclaw: houseData.ravenclaw.count ? Math.round(houseData.ravenclaw.total / houseData.ravenclaw.count) : 0,
      hufflepuff: houseData.hufflepuff.count ? Math.round(houseData.hufflepuff.total / houseData.hufflepuff.count) : 0
    };
    
    setHouseAverages(averages);
    
    setHouseStats({
      gryffindor: { points: averages.gryffindor, users: houseData.gryffindor.count },
      slytherin: { points: averages.slytherin, users: houseData.slytherin.count },
      ravenclaw: { points: averages.ravenclaw, users: houseData.ravenclaw.count },
      hufflepuff: { points: averages.hufflepuff, users: houseData.hufflepuff.count }
    });
  };
  
  const goToUserManagement = () => {
    navigate('/admin');
  };
  
  // Function to handle adding points
  const handleAddPoints = async (house, points) => {
    const buttonId = `${house.toLowerCase()}${points}`;
    setButtonLoading(prev => ({ ...prev, [buttonId]: true }));
    try {
      await updateHousePoints(house, points, reason);
      toast({
        title: points > 0 ? "Points Awarded!" : "Points Deducted!",
        description: `${Math.abs(points)} points have been ${points > 0 ? 'added to' : 'deducted from'} ${house}.` + (reason && reason.trim() !== '' ? ` Reason: ${reason}` : ''),
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Error updating points for ${house}:`, error);
      toast({
        title: "Error",
        description: `Failed to update points for ${house}: ${error.message || 'Unknown error'}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setButtonLoading(prev => ({ ...prev, [buttonId]: false }));
    }
  };
  
  // Function to handle subtracting points
  const handleSubtractPoints = async (house) => {
    // Get button ID for this operation
    const buttonId = `${house.toLowerCase()}Minus`;
    
    // Set just this button to loading state
    setButtonLoading(prev => ({
      ...prev,
      [buttonId]: true
    }));
    
    try {
      const pointsStr = prompt(`How many points to deduct from ${house}?`);
      if (!pointsStr) return;
      
      const points = -Math.abs(parseInt(pointsStr, 10));
      if (isNaN(points)) {
        toast({
          title: "Invalid Input",
          description: "Please enter a valid number.",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      const reason = prompt(`Reason for deducting ${Math.abs(points)} points from ${house}?`);
      if (reason) {
        await updateHousePoints(house, points, reason);
        toast({
          title: "Points Deducted!",
          description: `${Math.abs(points)} points have been deducted from ${house}.`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error(`Error deducting points from ${house}:`, error);
      toast({
        title: "Error",
        description: `Failed to deduct points from ${house}: ${error.message || 'Unknown error'}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      // Reset only this button's loading state
      setButtonLoading(prev => ({
        ...prev,
        [buttonId]: false
      }));
    }
  };
  
  const forceSyncAllHouseUsers = async (house) => {
    try {
      const response = await fetch('https://be-web-6c4k.onrender.com/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      
      const data = await response.json();
      const houseUsers = data.users.filter(user => user.house === house);
      
      if (houseUsers.length > 0) {
        const userIds = houseUsers.map(user => user._id);
        await forceSyncForUsers(userIds);
        
        console.log(`Forced sync for ${userIds.length} users in ${house} house`);
      } else {
        console.log(`No users found in ${house} house`);
      }
    } catch (err) {
      console.error('Error syncing house users:', err);
    }
  };
  
  const handleGroupCriteriaSubmit = async () => {
    setButtonLoading(prev => ({ ...prev, customPoints: true }));
    try {
      const success = await updateGroupCriteriaPoints(
        groupHouse, 
        criteriaType, 
        performanceLevel, 
        details
      );
      
      if (success) {
        const selectedPerformance = performanceLevels.find(p => p.value === performanceLevel);
        const selectedCriteria = criteriaTypes.find(c => c.value === criteriaType);
        
        toast({
          title: selectedPerformance.points > 0 ? 'Points Added' : 'Points Deducted',
          description: `${Math.abs(selectedPerformance.points)} points ${selectedPerformance.points > 0 ? 'awarded to' : 'deducted from'} ${groupHouse} for ${selectedCriteria.label}`,
          status: 'success',
          duration: 2000,
        });
        setDetails('');
        
        setTimeout(() => {
          forceSyncAllHouseUsers(groupHouse);
        }, 500);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update points',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setButtonLoading(prev => ({ ...prev, customPoints: false }));
    }
  };
  
  if (!isAdmin) {
    return null;
  }
  
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
            size={{ base: "md", md: "lg" }} 
            className="admin-title"
            textAlign={{ base: "center", md: "left" }}
          >
            Hogwarts House Points
          </Heading>
          <Stack 
            direction={{ base: "row", md: "row" }} 
            justify={{ base: "center", md: "flex-end" }}
            spacing={2}
            wrap="wrap"
            className="admin-nav"
          >
            <Badge colorScheme="purple" fontSize={{ base: "xs", md: "md" }} p={2} className="admin-badge">Admin Console</Badge>
            <Button 
              colorScheme="purple" 
              size={{ base: "xs", md: "sm" }} 
              onClick={goToUserManagement}
              className="admin-button primary"
            >
              User Management
            </Button>
            <Button 
              colorScheme="red" 
              size={{ base: "xs", md: "sm" }} 
              onClick={logout}
              className="admin-button danger"
            >
              Logout
            </Button>
          </Stack>
        </Stack>
        
        <Divider />
        
        {error && (
          <Box className="admin-message-box error">
            <Text>{error}</Text>
          </Box>
        )}
        
        <Box className="admin-tabs">
          <Tabs variant="enclosed" colorScheme="yellow" isFitted>
            <TabList className="admin-tabs-list">
              <Tab className="admin-tab" _selected={{ className: "admin-tab active" }}>House Points</Tab>
              <Tab className="admin-tab" _selected={{ className: "admin-tab active" }}>Group Assessment</Tab>
              <Tab className="admin-tab" _selected={{ className: "admin-tab active" }}>House Statistics</Tab>
            </TabList>
            
            <TabPanels>
              <TabPanel className="admin-tab-content active">
                <Box className="admin-panel">
                  <VStack spacing={5} align="stretch">
                    <FormControl className="admin-form-group">
                      <FormLabel className="admin-form-label">Select House</FormLabel>
                      <Select 
                        value={selectedHouse} 
                        onChange={(e) => setSelectedHouse(e.target.value)}
                        className="admin-house-select"
                        bg={houses.find(h => h.value === selectedHouse)?.bgColor || 'gray.700'}
                        color={houses.find(h => h.value === selectedHouse)?.textColor || 'white'}
                        borderColor={houses.find(h => h.value === selectedHouse)?.color || 'gray.500'}
                      >
                        {houses.map(house => (
                          <option key={house.value} value={house.value}>
                            {house.label}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <FormControl className="admin-form-group">
                      <FormLabel className="admin-form-label">Reason for Point Change</FormLabel>
                      <Textarea 
                        value={reason} 
                        onChange={(e) => setReason(e.target.value)} 
                        placeholder="Enter reason for point change (e.g., 'Outstanding performance in Potions class')"
                        className="admin-form-textarea"
                      />
                    </FormControl>
                    
                    <Box className="admin-control-bar">
                      <Text className="info-text">Award or deduct points from {houses.find(h => h.value === selectedHouse)?.label}</Text>
                    </Box>
                    
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <VStack spacing={3}>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, 10)}
                          isLoading={buttonLoading[`${selectedHouse}10`]}
                          leftIcon={<Text as="span">+10</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}10`]}
                          className="admin-button success"
                          width="100%"
                        >
                          Award 10 Points
                        </Button>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, 20)}
                          isLoading={buttonLoading[`${selectedHouse}20`]}
                          leftIcon={<Text as="span">+20</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}20`]}
                          className="admin-button success"
                          width="100%"
                        >
                          Award 20 Points
                        </Button>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, 30)}
                          isLoading={buttonLoading[`${selectedHouse}30`]}
                          leftIcon={<Text as="span">+30</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}30`]}
                          className="admin-button success"
                          width="100%"
                        >
                          Award 30 Points
                        </Button>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, 40)}
                          isLoading={buttonLoading[`${selectedHouse}40`]}
                          leftIcon={<Text as="span">+40</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}40`]}
                          className="admin-button success"
                          width="100%"
                        >
                          Award 40 Points
                        </Button>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, -20)}
                          isLoading={buttonLoading[`${selectedHouse}-20`]}
                          leftIcon={<Text as="span">-20</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}-20`]}
                          className="admin-button danger"
                          width="100%"
                        >
                          Deduct 20 Points
                        </Button>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, -30)}
                          isLoading={buttonLoading[`${selectedHouse}-30`]}
                          leftIcon={<Text as="span">-30</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}-30`]}
                          className="admin-button danger"
                          width="100%"
                        >
                          Deduct 30 Points
                        </Button>
                        <Button 
                          onClick={() => handleAddPoints(selectedHouse, -40)}
                          isLoading={buttonLoading[`${selectedHouse}-40`]}
                          leftIcon={<Text as="span">-40</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}-40`]}
                          className="admin-button danger"
                          width="100%"
                        >
                          Deduct 40 Points
                        </Button>
                      </VStack>
                      
                      <VStack spacing={3}>
                        <Button 
                          onClick={() => handleSubtractPoints(selectedHouse)}
                          isLoading={buttonLoading[`${selectedHouse}Minus`]}
                          leftIcon={<Text as="span">-10</Text>}
                          isDisabled={buttonLoading[`${selectedHouse}Minus`]}
                          className="admin-button danger"
                          width="100%"
                        >
                          Deduct Points
                        </Button>
                      </VStack>
                    </SimpleGrid>
                  </VStack>
                </Box>
              </TabPanel>
              
              <TabPanel className="admin-tab-content active">
                <Box className="admin-panel">
                  <VStack spacing={5} align="stretch">
                    <FormControl className="admin-form-group">
                      <FormLabel className="admin-form-label">Select House</FormLabel>
                      <Select 
                        value={groupHouse} 
                        onChange={(e) => setGroupHouse(e.target.value)}
                        className="admin-house-select"
                        bg={houses.find(h => h.value === groupHouse)?.bgColor || 'gray.700'}
                        color={houses.find(h => h.value === groupHouse)?.textColor || 'white'}
                        borderColor={houses.find(h => h.value === groupHouse)?.color || 'gray.500'}
                      >
                        {houses.map(house => (
                          <option key={house.value} value={house.value}>
                            {house.label}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <FormControl className="admin-form-group">
                      <FormLabel className="admin-form-label">Assessment Criteria</FormLabel>
                      <Select 
                        value={criteriaType} 
                        onChange={(e) => setCriteriaType(e.target.value)}
                        className="admin-form-input"
                      >
                        {criteriaTypes.map(criteria => (
                          <option key={criteria.value} value={criteria.value}>
                            {criteria.label}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <FormControl className="admin-form-group">
                      <FormLabel className="admin-form-label">Performance Level</FormLabel>
                      <RadioGroup value={performanceLevel} onChange={setPerformanceLevel}>
                        <Stack direction="column" spacing={2} className="admin-radio-group">
                          {performanceLevels.map(level => (
                            <Box 
                              key={level.value} 
                              className={`admin-radio-item ${performanceLevel === level.value ? 'checked' : ''}`}
                            >
                              <Radio 
                                value={level.value}
                                colorScheme={level.points > 0 ? "green" : "red"}
                              >
                                <HStack>
                                  <Text fontWeight="medium">{level.label}</Text>
                                  <Badge 
                                    colorScheme={level.points > 0 ? "green" : "red"}
                                    className={`admin-badge ${level.points > 0 ? 'success' : 'danger'}`}
                                  >
                                    {level.points > 0 ? `+${level.points}` : level.points}
                                  </Badge>
                                </HStack>
                              </Radio>
                            </Box>
                          ))}
                        </Stack>
                      </RadioGroup>
                    </FormControl>
                    
                    <FormControl className="admin-form-group">
                      <FormLabel className="admin-form-label">Additional Details (Optional)</FormLabel>
                      <Textarea 
                        value={details} 
                        onChange={(e) => setDetails(e.target.value)} 
                        placeholder="Enter any additional details about this assessment"
                        className="admin-form-textarea"
                      />
                    </FormControl>
                    
                    <Button 
                      onClick={handleGroupCriteriaSubmit}
                      isLoading={buttonLoading.customPoints}
                      className="admin-button info"
                      width="100%"
                      mt={2}
                    >
                      Submit Assessment
                    </Button>
                  </VStack>
                </Box>
              </TabPanel>
              
              <TabPanel className="admin-tab-content active">
                <Box className="admin-panel">
                  <VStack spacing={6} align="stretch">
                    <Box className="admin-control-bar">
                      <Text className="info-text">Average magic points across all users in each Hogwarts house</Text>
                      <Button 
                        onClick={calculateHouseAverages}
                        isLoading={loading}
                        className="admin-button primary"
                        size="sm"
                      >
                        Refresh Data
                      </Button>
                    </Box>
                    
                    {loading ? (
                      <Flex justify="center" py={10} className="admin-loading">
                        <div className="admin-loading-spinner"></div>
                      </Flex>
                    ) : (
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} className="admin-stats-grid">
                        {houses.map(house => (
                          <Box
                            key={house.value}
                            className={`house-points-card ${house.value}`}
                            style={{
                              background: `linear-gradient(135deg, ${house.bgColor}, ${house.bgColor}CC)`,
                              color: house.textColor
                            }}
                          >
                            <Box className="admin-card-body">
                              <Flex justify="space-between" align="center">
                                <VStack align="start" spacing={0}>
                                  <Heading size="md">{house.label}</Heading>
                                  <Badge 
                                    className="house-badge"
                                    style={{
                                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                                      color: house.textColor
                                    }}
                                  >
                                    {houseStats[house.value]?.users || 0} students
                                  </Badge>
                                </VStack>
                                
                                <Box 
                                  p={3} 
                                  borderRadius="full" 
                                  bg={`${house.textColor}DD`}
                                  color={house.bgColor}
                                  fontWeight="bold"
                                  fontSize="2xl"
                                  className="point-badge"
                                >
                                  {houseAverages[house.value] || 0}
                                </Box>
                              </Flex>
                              
                              <Text mt={4} fontSize="sm" opacity={0.9}>
                                Average points per student
                              </Text>
                            </Box>
                          </Box>
                        ))}
                      </SimpleGrid>
                    )}
                  </VStack>
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </VStack>
    </Box>
  );
};

export default AdminHousePoints;