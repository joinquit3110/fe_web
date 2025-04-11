import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Box, Button, Heading, VStack, HStack, Badge, 
  Text, useToast, Divider, Flex, Spinner,
  Tabs, TabList, TabPanels, Tab, TabPanel,
  FormControl, FormLabel, Select, Input, Textarea,
  Radio, RadioGroup, Stack
} from '@chakra-ui/react';
import '../styles/Admin.css';

const AdminHousePoints = () => {
  const { 
    isAdmin,
    updateHousePoints,
    updateGroupCriteriaPoints,
    criteriaPoints,
    loading,
    error
  } = useAdmin();
  
  const { logout } = useAuth();
  const toast = useToast();
  
  // State for direct house points
  const [selectedHouse, setSelectedHouse] = useState('gryffindor');
  const [reason, setReason] = useState('');
  
  // State for group performance assessment
  const [groupHouse, setGroupHouse] = useState('gryffindor');
  const [criteriaType, setCriteriaType] = useState('participation');
  const [performanceLevel, setPerformanceLevel] = useState('satisfactory');
  const [details, setDetails] = useState('');
  
  // Houses options
  const houses = [
    { value: 'gryffindor', label: 'Gryffindor', color: 'red.500', bgColor: '#740001', textColor: '#FFC500' },
    { value: 'slytherin', label: 'Slytherin', color: 'green.500', bgColor: '#1A472A', textColor: '#AAAAAA' },
    { value: 'ravenclaw', label: 'Ravenclaw', color: 'blue.500', bgColor: '#0E1A40', textColor: '#946B2D' },
    { value: 'hufflepuff', label: 'Hufflepuff', color: 'yellow.500', bgColor: '#ecb939', textColor: '#000000' }
  ];
  
  // Criteria options
  const criteriaTypes = [
    { value: 'participation', label: 'Level of participation of group members' },
    { value: 'english', label: 'Level of English usage in the group' },
    { value: 'completion', label: 'Time taken by the group to complete tasks' }
  ];
  
  // Performance levels
  const performanceLevels = [
    { value: 'excellent', label: 'Excellent', points: criteriaPoints.excellent },
    { value: 'good', label: 'Good', points: criteriaPoints.good },
    { value: 'satisfactory', label: 'Satisfactory', points: criteriaPoints.satisfactory },
    { value: 'poor', label: 'Poor', points: criteriaPoints.poor },
    { value: 'veryPoor', label: 'Very Poor', points: criteriaPoints.veryPoor }
  ];
  
  // Add points to a house
  const handleAddPoints = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for awarding points',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    try {
      const success = await updateHousePoints(selectedHouse, 10, reason);
      
      if (success) {
        toast({
          title: 'Points Added',
          description: `10 points awarded to ${selectedHouse}: ${reason}`,
          status: 'success',
          duration: 2000,
        });
        setReason('');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add points',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  // Deduct points from a house
  const handleDeductPoints = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for deducting points',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    try {
      const success = await updateHousePoints(selectedHouse, -10, reason);
      
      if (success) {
        toast({
          title: 'Points Deducted',
          description: `10 points deducted from ${selectedHouse}: ${reason}`,
          status: 'success',
          duration: 2000,
        });
        setReason('');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to deduct points',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  // Update points based on group criteria
  const handleGroupCriteriaSubmit = async () => {
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
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update points',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  // If not admin, don't show anything
  if (!isAdmin) {
    return null;
  }
  
  return (
    <Box className="admin-user-management">
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Heading size="lg" className="highlight admin-title">Hogwarts House Points</Heading>
          <HStack>
            <Badge colorScheme="purple" fontSize="md" p={2}>Admin Console</Badge>
            <Button colorScheme="red" size="sm" onClick={logout}>Logout</Button>
          </HStack>
        </HStack>
        
        <Divider />
        
        {error && (
          <Box className="message-box error">
            <Text className="message-content">{error}</Text>
          </Box>
        )}
        
        <Tabs variant="enclosed" colorScheme="purple">
          <TabList>
            <Tab>House Points</Tab>
            <Tab>Group Assessment</Tab>
          </TabList>
          
          <TabPanels>
            {/* Direct House Points Tab */}
            <TabPanel>
              <Box className="wizard-panel" p={4} borderRadius="md">
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel>Select House</FormLabel>
                    <Select 
                      value={selectedHouse} 
                      onChange={(e) => setSelectedHouse(e.target.value)}
                      className="admin-house-select"
                      bg={houses.find(h => h.value === selectedHouse)?.bgColor || 'gray.700'}
                      color={houses.find(h => h.value === selectedHouse)?.textColor || 'white'}
                      borderColor={houses.find(h => h.value === selectedHouse)?.color || 'gray.500'}
                      _hover={{ borderColor: 'white' }}
                    >
                      {houses.map(house => (
                        <option key={house.value} value={house.value}>
                          {house.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Reason</FormLabel>
                    <Textarea 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)} 
                      placeholder="Enter reason for point change"
                      className="inequality-input-field"
                    />
                  </FormControl>
                  
                  <HStack>
                    <Button 
                      colorScheme="green" 
                      onClick={handleAddPoints}
                      isLoading={loading}
                      leftIcon={<span>+10</span>}
                      isDisabled={!reason.trim()}
                      className="spellcast-button"
                    >
                      Award Points
                    </Button>
                    <Button 
                      colorScheme="red" 
                      onClick={handleDeductPoints}
                      isLoading={loading}
                      leftIcon={<span>-10</span>}
                      isDisabled={!reason.trim()}
                      className="spellcast-button"
                    >
                      Deduct Points
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            </TabPanel>
            
            {/* Group Assessment Tab */}
            <TabPanel>
              <Box className="wizard-panel" p={4} borderRadius="md">
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel>Select House</FormLabel>
                    <Select 
                      value={groupHouse} 
                      onChange={(e) => setGroupHouse(e.target.value)}
                      className="admin-house-select"
                      bg={houses.find(h => h.value === groupHouse)?.bgColor || 'gray.700'}
                      color={houses.find(h => h.value === groupHouse)?.textColor || 'white'}
                      borderColor={houses.find(h => h.value === groupHouse)?.color || 'gray.500'}
                      _hover={{ borderColor: 'white' }}
                    >
                      {houses.map(house => (
                        <option key={house.value} value={house.value}>
                          {house.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Assessment Criteria</FormLabel>
                    <Select 
                      value={criteriaType} 
                      onChange={(e) => setCriteriaType(e.target.value)}
                      className="inequality-input-field"
                    >
                      {criteriaTypes.map(criteria => (
                        <option key={criteria.value} value={criteria.value}>
                          {criteria.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Performance Level</FormLabel>
                    <RadioGroup value={performanceLevel} onChange={setPerformanceLevel}>
                      <Stack direction="column" spacing={2}>
                        {performanceLevels.map(level => (
                          <Radio 
                            key={level.value} 
                            value={level.value}
                            colorScheme={level.points > 0 ? "green" : "red"}
                          >
                            <HStack>
                              <Text>{level.label}</Text>
                              <Badge 
                                colorScheme={level.points > 0 ? "green" : "red"}
                              >
                                {level.points > 0 ? `+${level.points}` : level.points}
                              </Badge>
                            </HStack>
                          </Radio>
                        ))}
                      </Stack>
                    </RadioGroup>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Additional Details (Optional)</FormLabel>
                    <Textarea 
                      value={details} 
                      onChange={(e) => setDetails(e.target.value)} 
                      placeholder="Enter any additional details"
                      className="inequality-input-field"
                    />
                  </FormControl>
                  
                  <Button 
                    colorScheme="blue" 
                    onClick={handleGroupCriteriaSubmit}
                    isLoading={loading}
                    className="spellcast-button"
                  >
                    Submit Assessment
                  </Button>
                </VStack>
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default AdminHousePoints; 