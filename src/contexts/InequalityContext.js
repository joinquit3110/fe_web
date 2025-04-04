import React, { createContext, useContext, useState } from 'react';

const InequalityContext = createContext();

export const useInequalityContext = () => useContext(InequalityContext);

export const InequalityProvider = ({ children }) => {
  const [inequalities, setInequalities] = useState([]);

  const addInequality = (inequality) => {
    setInequalities(prev => [...prev, inequality]);
  };

  const removeInequality = (index) => {
    setInequalities(prev => prev.filter((_, i) => i !== index));
  };

  const clearInequalities = () => {
    setInequalities([]);
  };

  return (
    <InequalityContext.Provider value={{
      inequalities,
      addInequality,
      removeInequality,
      clearInequalities
    }}>
      {children}
    </InequalityContext.Provider>
  );
}; 