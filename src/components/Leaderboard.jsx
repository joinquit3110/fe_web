import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Heading, SimpleGrid, VStack, Text, Badge, Flex, HStack, Button,
  useToast, Spinner, Tooltip, keyframes
} from '@chakra-ui/react';
import { useAdmin } from '../contexts/AdminContext';
import '../styles/Admin.css';
import slytherinLogo from '../asset/Slytherin.png';
import ravenclawLogo from '../asset/Ravenclaw.png';
import gryffindorLogo from '../asset/Gryffindor.png';
import hufflepuffLogo from '../asset/Hufflepuff.png';

// Define animations
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 15px gold; }
  50% { box-shadow: 0 0 25px gold, 0 0 40px gold; }
  100% { box-shadow: 0 0 15px gold; }
`;

const shimmer = keyframes`
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Leaderboard = () => {
  const { users, fetchUsers } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      await fetchUsers();
      
      if (isManualRefresh) {
        toast({
          title: 'House Cup Updated',
          description: 'Latest house points have been loaded',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      }
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
      setRefreshing(false);
    }
  }, [fetchUsers, toast]);

  useEffect(() => {
    loadData();
    // Refresh data every 60 seconds
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

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
        <Flex justify="center" align="center" position="relative">
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
              Hogwarts House Cup
              <span style={{
                position: "absolute",
                bottom: "-5px",
                left: "0",
                right: "0",
                height: "2px",
                background: "linear-gradient(90deg, transparent, var(--secondary-color), transparent)",
                backgroundSize: "200% 100%",
                animation: `${shimmer} 2s infinite linear`
              }}></span>
            </span>
          </Heading>
          
          <Tooltip label="Refresh House Cup" placement="top">
            <Button
              position="absolute"
              right="5px"
              top="5px"
              size="sm"
              borderRadius="full"
              width="40px"
              height="40px"
              bg="transparent"
              color="var(--secondary-color)"
              border="2px solid var(--secondary-color)"
              _hover={{
                bg: "rgba(211, 166, 37, 0.1)",
                transform: "rotate(180deg)",
                transition: "transform 0.5s"
              }}
              _active={{
                bg: "rgba(211, 166, 37, 0.2)",
              }}
              onClick={() => loadData(true)}
              isLoading={refreshing}
              css={{
                "&:focus": {
                  boxShadow: "0 0 0 3px rgba(211, 166, 37, 0.3)"
                },
                transition: "all 0.3s"
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                className="refresh-icon" style={{ animation: refreshing ? `${spin} 1s infinite linear` : 'none' }}>
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
              </svg>
            </Button>
          </Tooltip>
        </Flex>

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
                  background: `linear-gradient(135deg, ${house.bgColor} 30%, ${house.bgColor}DD 70%, ${house.bgColor}CC)`,
                  color: house.textColor,
                  position: 'relative',
                  boxShadow: index === 0 
                    ? '0 0 30px 8px gold, 0 0 10px 2px #fff' 
                    : '0 6px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
                  border: index === 0 ? '3px solid gold' : '2px solid rgba(255,255,255,0.6)',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  minHeight: '220px',
                  marginTop: index === 0 ? '-10px' : '0',
                  zIndex: index === 0 ? 2 : 1,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  animation: index === 0 ? `${glow} 3s infinite` : 'none',
                  transform: index === 0 ? 'scale(1.05)' : 'scale(1)',
                }}
                _hover={{
                  transform: index === 0 ? 'scale(1.08)' : 'scale(1.03)',
                  boxShadow: index === 0 
                    ? '0 0 40px 10px gold, 0 0 15px 3px #fff' 
                    : '0 8px 24px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.2)',
                }}
              >
                <Flex direction="column" align="center" justify="center" h="100%">
                  <img 
                    src={house.logo} 
                    alt={`${house.label} crest`} 
                    style={{
                      width: index === 0 ? '110px' : '90px',
                      height: 'auto',
                      marginTop: '18px',
                      marginBottom: '8px',
                      filter: index === 0 ? 'drop-shadow(0 0 16px gold)' : 'drop-shadow(0 0 8px #fff)',
                      transition: 'all 0.3s ease',
                      zIndex: 2,
                      animation: index === 0 ? `${pulse} 3s infinite ease-in-out` : 'none',
                    }}
                  />
                  <Heading size="lg" mt={2} mb={1} style={{
                    fontFamily: 'Cinzel, serif',
                    letterSpacing: '2px',
                    color: house.textColor,
                    textShadow: index === 0 ? '0 0 10px gold, 0 0 20px gold' : '0 0 6px #fff',
                    fontWeight: 700
                  }}>{house.label}</Heading>
                  <Badge 
                    className="house-badge"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: house.textColor,
                      fontSize: '1rem',
                      marginBottom: '6px',
                      marginTop: '2px',
                      border: '1.5px solid #fff',
                      borderRadius: '12px',
                      padding: '4px 16px',
                      fontWeight: 600,
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    {houseStats[house.value]?.users || 0} students
                  </Badge>
                  <Box 
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    width={index === 0 ? '110px' : '90px'}
                    height={index === 0 ? '110px' : '90px'}
                    p={0}
                    borderRadius="full" 
                    bg={index === 0 ? 'gold' : `${house.textColor}DD`}
                    color={index === 0 ? house.bgColor : house.bgColor}
                    fontWeight="bold"
                    fontSize={index === 0 ? '3rem' : '2.5rem'}
                    className="point-badge"
                    boxShadow={index === 0 ? '0 0 20px gold' : '0 0 8px #fff'}
                    mt={2}
                    mb={2}
                    style={{
                      minWidth: index === 0 ? '110px' : '90px',
                      minHeight: index === 0 ? '110px' : '90px',
                      maxWidth: index === 0 ? '110px' : '90px',
                      maxHeight: index === 0 ? '110px' : '90px',
                      aspectRatio: '1/1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      letterSpacing: '1px',
                      border: index === 0 ? '3px solid #fff' : '2px solid #fff',
                      transition: 'all 0.3s ease',
                      animation: index === 0 ? `${pulse} 3s infinite ease-in-out` : 'none',
                    }}
                  >
                    {houseStats[house.value]?.points || 0}
                  </Box>
                  {/* Creative Rank Ribbon/Badge */}
                  <Box
                    mt={2}
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <span style={{
                      background: index === 0 
                        ? 'linear-gradient(90deg, #ffd700, #fff6a0, #ffd700)' 
                        : 'linear-gradient(90deg, #333, #666, #333)',
                      backgroundSize: '200% 100%',
                      animation: index === 0 ? `${shimmer} 2s infinite linear` : 'none',
                      color: index === 0 ? '#8B7700' : '#fff',
                      borderRadius: '16px',
                      padding: '4px 18px',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      boxShadow: index === 0 ? '0 0 10px gold' : '0 0 6px #fff',
                      letterSpacing: '1px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: index === 0 ? '2px solid #fffbe7' : '1.5px solid #fff',
                      marginBottom: '4px',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(2px)',
                    }}>
                      {index === 0 ? '👑' : '🏅'}
                      {index === 0 ? 'HOUSE CHAMPION' : `RANK #${index + 1}`}
                    </span>
                  </Box>
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