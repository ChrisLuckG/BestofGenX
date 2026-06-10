"use client";

import { useState, useCallback } from "react";
import { AlertType } from "@/components/AlertModal";

interface AlertState {
  show: boolean;
  type: AlertType;
  title?: string;
  message: string;
  buttonText?: string;
  onButtonClick?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
  details?: string[];
}

const initialState: AlertState = {
  show: false,
  type: 'info',
  message: ''
};

export function useAlert() {
  const [alertState, setAlertState] = useState<AlertState>(initialState);

  const showAlert = useCallback((
    type: AlertType, 
    message: string, 
    options?: { 
      title?: string; 
      buttonText?: string; 
      onButtonClick?: () => void;
      secondaryButtonText?: string;
      onSecondaryButtonClick?: () => void;
      details?: string[];
    }
  ) => {
    setAlertState({
      show: true,
      type,
      message,
      title: options?.title,
      buttonText: options?.buttonText,
      onButtonClick: options?.onButtonClick,
      secondaryButtonText: options?.secondaryButtonText,
      onSecondaryButtonClick: options?.onSecondaryButtonClick,
      details: options?.details
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, show: false }));
  }, []);

  // Convenience methods
  const showError = useCallback((message: string, title?: string) => {
    showAlert('error', message, { title });
  }, [showAlert]);

  const showSuccess = useCallback((message: string, title?: string) => {
    showAlert('success', message, { title });
  }, [showAlert]);

  const showInfo = useCallback((message: string, title?: string) => {
    showAlert('info', message, { title });
  }, [showAlert]);

  const showLoginRequired = useCallback((message = 'Please login to continue!') => {
    showAlert('login', message);
  }, [showAlert]);

  const showNotEnoughCoins = useCallback((message = 'You need more coins!') => {
    showAlert('coins', message);
  }, [showAlert]);

  return {
    alertState,
    showAlert,
    hideAlert,
    showError,
    showSuccess,
    showInfo,
    showLoginRequired,
    showNotEnoughCoins
  };
}
