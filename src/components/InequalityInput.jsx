import React, { useState, useEffect, useRef } from 'react';
import { Box, Input, Button, Text, Flex } from '@chakra-ui/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const InequalityInput = ({ onSubmit, onFormatCheck }) => {
  const [inequality, setInequality] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const previewRef = useRef(null);

  useEffect(() => {
    try {
      if (inequality) {
        const latexString = inequality
          .replace(/</g, '\\lt ')
          .replace(/>/g, '\\gt ')
          .replace(/≤/g, '\\leq ')
          .replace(/≥/g, '\\geq ')
          .replace(/!=/g, '\\neq ');
        
        katex.render(latexString, previewRef.current, {
          throwOnError: false,
          displayMode: true
        });
        setPreview(latexString);
        setError('');
      }
    } catch (err) {
      setError('Invalid inequality format');
    }
  }, [inequality]);

  const handleSubmit = () => {
    if (inequality.trim()) {
      onSubmit(inequality);
      setInequality('');
    }
  };

  return (
    <Box className="magical-input-container">
      <Flex direction="column" align="center" gap={4}>
        <Box 
          className="magical-parchment"
          p={4}
          borderRadius="md"
          position="relative"
          width="100%"
          maxW="500px"
        >
          <Input
            value={inequality}
            onChange={(e) => setInequality(e.target.value)}
            placeholder="Write your inequality spell (e.g., 2x + 3y ≤ 5)"
            className="magical-input"
            _focus={{
              borderColor: 'var(--secondary-color)',
              boxShadow: 'var(--spell-glow)'
            }}
          />
          
          <Box 
            mt={2} 
            p={3} 
            borderRadius="md"
            className="magical-preview"
            bg="rgba(20, 23, 46, 0.6)"
            border="1px solid var(--panel-border)"
          >
            <Text className="magical-text" mb={2}>
              Preview of your magical formula:
            </Text>
            <Box 
              ref={previewRef} 
              className="preview-content"
              minH="40px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            />
          </Box>

          {error && (
            <Text 
              color="var(--error-color)" 
              mt={2}
              className="magical-error"
            >
              {error}
            </Text>
          )}
        </Box>

        <Flex gap={4}>
          <Button
            onClick={handleSubmit}
            className="magical-button"
            disabled={!inequality.trim() || !!error}
          >
            Cast Spell
          </Button>
          
          <Button
            onClick={() => onFormatCheck(inequality)}
            className="magical-button format-check"
            variant="outline"
            disabled={!inequality.trim()}
          >
            Check Spell Format
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};

export default InequalityInput;
