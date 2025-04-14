
import React from 'react';
import { Box, Flex, Button, useBreakpointValue } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useAdmin } from '../contexts/AdminContext';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const { isAdmin } = useAdmin();
  const buttonSize = useBreakpointValue({ base: 'sm', md: 'md' });
  
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  return (
    <Box 
      as={motion.div}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="tab-navigation wizard-panel"
      mb={4}
      p={2}
      borderRadius="lg"
    >
      <Flex 
        gap={2} 
        justifyContent="center"
        flexWrap="wrap"
      >
        <Button
          size={buttonSize}
          variant="ghost"
          className={`magical-tab ${activeTab === 'activity1' ? 'active' : ''}`}
          onClick={() => handleTabClick('activity1')}
          _hover={{ transform: 'translateY(-2px)' }}
          transition="all 0.2s"
        >
          {isAdmin ? 'Transfiguration Chamber' : 'Magical Inequalities'}
        </Button>
        <Button
          size={buttonSize}
          variant="ghost"
          className={`magical-tab ${activeTab === 'activity2' ? 'active' : ''}`}
          onClick={() => handleTabClick('activity2')}
          _hover={{ transform: 'translateY(-2px)' }}
          transition="all 0.2s"
        >
          {isAdmin ? 'Wizardry Console' : 'Advanced Spells'}
        </Button>
      </Flex>
    </Box>
  );
};

export default TabNavigation;
