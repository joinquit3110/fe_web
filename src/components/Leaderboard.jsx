import React, { useState, useEffect } from 'react';
import {
  Box, Heading, SimpleGrid, VStack, Text, Badge, Flex, HStack,
  useToast, Spinner
} from '@chakra-ui/react';
import { useAdmin } from '../contexts/AdminContext';
import '../styles/Admin.css';
import slytherinLogo from '../asset/Slytherin.png';
import ravenclawLogo from '../asset/Ravenclaw.png';
import gryffindorLogo from '../asset/Gryffindor.png';
import hufflepuffLogo from '../asset/Hufflepuff.png';

const Leaderboard = () => {
  const { users, fetchUsers } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [houseStats, setHouseStats] = useState({
    gryffindor: { points: 0, users: 0 },
    slytherin: { points: 0, users: 0 },
    ravenclaw: { points: 0, users: 0 },
    hufflepuff: { points: 0, users: 0 }
  });

  // House definitions with logo
  const houses = [
    { value: 'gryffindor', label: 'Gryffindor', color: 'red.500', bgColor: '#740001', textColor: '#FFC500', logo: gryffindorLogo },
    { value: 'slytherin', label: 'Slytherin', color: 'green.500', bgColor: '#1A472A', textColor: '#AAAAAA', logo: slytherinLogo },
    { value: 'ravenclaw', label: 'Ravenclaw', color: 'blue.500', bgColor: '#0E1A40', textColor: '#946B2D', logo: ravenclawLogo },
    { value: 'hufflepuff', label: 'Hufflepuff', color: 'yellow.500', bgColor: '#ecb939', textColor: '#000000', logo: hufflepuffLogo }
  ];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchUsers();
      } catch (err) {
        toast({
          title: 'Error loading leaderboard data',
          description: err.message || 'Failed to fetch house data',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Refresh data every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [fetchUsers, toast]);

  useEffect(() => {
    if (!users || users.length === 0) return;
    
    const houseData = {
      gryffindor: { total: 0, count: 0 },
      slytherin: { total: 0, count: 0 },
      ravenclaw: { total: 0, count: 0 },
      hufflepuff: { total: 0, count: 0 }
    };
    
    users.forEach(user => {
      const house = user.house;
      if (!house || !houseData[house] || house === 'admin' || house === 'muggle') return;
      
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
    
    setHouseStats({
      gryffindor: { points: averages.gryffindor, users: houseData.gryffindor.count },
      slytherin: { points: averages.slytherin, users: houseData.slytherin.count },
      ravenclaw: { points: averages.ravenclaw, users: houseData.ravenclaw.count },
      hufflepuff: { points: averages.hufflepuff, users: houseData.hufflepuff.count }
    });
  }, [users]);

  // Sort houses by average points
  const sortedHouses = [...houses].sort((a, b) => 
    (houseStats[b.value]?.points || 0) - (houseStats[a.value]?.points || 0)
  );

  return (
    <Box className="wizard-panel">
      <VStack spacing={4} align="stretch">
        <Heading 
          className="activity-title" 
          fontFamily="'Cinzel', serif"
          textAlign="center"
          position="relative"
          textShadow="0 0 10px rgba(211, 166, 37, 0.5)"
          letterSpacing="1px"
          mb={4}
        >
          <span style={{
            display: "inline-block",
            padding: "0 30px",
            position: "relative"
          }}>
            Hogwarts House Cup Leaderboard
            <span style={{
              position: "absolute",
              bottom: "-5px",
              left: "0",
              right: "0",
              height: "2px",
              background: "linear-gradient(to right, transparent, var(--secondary-color), transparent)",
              animation: "shimmer 2s infinite"
            }}></span>
          </span>
        </Heading>

        {loading ? (
          <Flex justify="center" py={10} align="center" height="200px">
            <Spinner size="xl" color="var(--secondary-color)" thickness="4px" />
          </Flex>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={7} className="admin-stats-grid">
            {sortedHouses.map((house, index) => (
              <Box
                key={house.value}
                className={`house-points-card ${house.value}`}
                style={{
                  background: `linear-gradient(135deg, ${house.bgColor}, ${house.bgColor}CC)`,
                  color: house.textColor,
                  position: 'relative',
                  boxShadow: index === 0 ? '0 0 30px 8px gold, 0 0 10px 2px #fff' : '0 2px 12px rgba(0,0,0,0.3)',
                  border: index === 0 ? '3px solid gold' : '2px solid #fff',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  minHeight: '220px',
                  marginTop: index === 0 ? '-10px' : '0',
                  zIndex: index === 0 ? 2 : 1
                }}
              >
                {index === 0 && (
                  <Badge 
                    position="absolute"
                    top="-10px"
                    right="-10px"
                    borderRadius="full"
                    bg="gold"
                    color="black"
                    p={2}
                    fontWeight="bold"
                    fontSize="lg"
                    boxShadow="0 0 20px gold"
                  >
                    🏆 House Champion
                  </Badge>
                )}
                <Flex direction="column" align="center" justify="center" h="100%">
                  <img 
                    src={house.logo} 
                    alt={`${house.label} crest`} 
                    style={{
                      width: '90px',
                      height: 'auto',
                      marginTop: '18px',
                      marginBottom: '8px',
                      filter: index === 0 ? 'drop-shadow(0 0 16px gold)' : 'drop-shadow(0 0 8px #fff)',
                      transition: 'filter 0.3s',
                      zIndex: 2
                    }}
                  />
                  <Heading size="lg" mt={2} mb={1} style={{
                    fontFamily: 'Cinzel, serif',
                    letterSpacing: '2px',
                    color: house.textColor,
                    textShadow: index === 0 ? '0 0 10px gold' : '0 0 6px #fff',
                    fontWeight: 700
                  }}>{house.label}</Heading>
                  <Badge 
                    className="house-badge"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.18)",
                      color: house.textColor,
                      fontSize: '1rem',
                      marginBottom: '6px',
                      marginTop: '2px',
                      border: '1.5px solid #fff',
                      borderRadius: '12px',
                      padding: '4px 16px',
                      fontWeight: 600
                    }}
                  >
                    {houseStats[house.value]?.users || 0} students
                  </Badge>
                  <Box 
                    p={3} 
                    borderRadius="full" 
                    bg={index === 0 ? 'gold' : `${house.textColor}DD`}
                    color={index === 0 ? house.bgColor : house.bgColor}
                    fontWeight="bold"
                    fontSize="2.5rem"
                    className="point-badge"
                    boxShadow={index === 0 ? '0 0 20px gold' : '0 0 8px #fff'}
                    mt={2}
                  >
                    {houseStats[house.value]?.points || 0}
                  </Box>
                  <HStack mt={4} justify="space-between" w="100%">
                    <Text fontSize="sm" opacity={0.9}>
                      Average points per student
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      Rank: #{index + 1}
                    </Text>
                  </HStack>
                </Flex>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </VStack>
    </Box>
  );
};

export default Leaderboard;