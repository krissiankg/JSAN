"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RoleContextType {
  isOrganisateur: boolean;
  toggleOrganisateur: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isOrganisateur, setIsOrganisateur] = useState<boolean>(false);

  const toggleOrganisateur = () => {
    setIsOrganisateur(prev => !prev);
  };

  return (
    <RoleContext.Provider value={{ isOrganisateur, toggleOrganisateur }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
