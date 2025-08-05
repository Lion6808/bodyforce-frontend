import React, { useState } from 'react';
import './MemberForm.css'; // Vous devrez créer ce fichier CSS

// Import des composants
import MemberFormHeader from './MemberFormHeader';
import IdentityTab from './tabs/IdentityTab';
import ContactTab from './tabs/ContactTab';
import SubscriptionTab from './tabs/SubscriptionTab';
import DocumentsTab from './tabs/DocumentsTab';
import PaymentsTab from './tabs/PaymentsTab';
import CameraModal from './CameraModal';

// Import du hook personnalisé
import { useMemberForm } from './useMemberForm';

const MemberForm = ({ memberId, onSave, onCancel, mode = 'create' }) => {
  // État local pour l'onglet actif
  const [activeTab, setActiveTab] = useState('identity');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  // Utilisation du hook personnalisé pour la logique métier
  const {
    formData,
    errors,
    isLoading,
    isSaving,
    validationErrors,
    updateFormData,
    validateForm,
    saveForm,
    resetForm,
    handlePhotoCapture,
    deletePhoto
  } = useMemberForm(memberId, mode);

  // Gestion de la sauvegarde
  const handleSave = async () => {
    const isValid = validateForm();
    if (isValid) {
      const success = await saveForm();
      if (success && onSave) {
        onSave(formData);
      }
    } else {
      setAlertMessage('Veuillez corriger les erreurs avant de sauvegarder.');
      setShowAlert(true);
    }
  };

  // Gestion de l'annulation
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Configuration des onglets
  const tabs = [
    {
      key: 'identity',
      icon: '👤',
      label: 'Identité',
      component: IdentityTab
    },
    {
      key: 'contact',
      icon: '📧',
      label: 'Contact',
      component: ContactTab
    },
    {
      key: 'subscription',
      icon: '🎫',
      label: 'Adhésion',
      component: SubscriptionTab
    },
    {
      key: 'documents',
      icon: '📄',
      label: 'Documents',
      component: DocumentsTab
    },
    {
      key: 'payments',
      icon: '💳',
      label: 'Paiements',
      component: PaymentsTab
    }
  ];

  // Rendu du composant actif
  const renderActiveTab = () => {
    const activeTabConfig = tabs.find(tab => tab.key === activeTab);
    if (!activeTabConfig) return null;

    const TabComponent = activeTabConfig.component;
    
    return (
      <TabComponent
        formData={formData}
        errors={errors}
        validationErrors={validationErrors}
        updateFormData={updateFormData}
        onPhotoCapture={handlePhotoCapture}
        onDeletePhoto={deletePhoto}
        isLoading={isLoading}
      />
    );
  };

  return (
    <div className="member-form">
      {/* Header */}
      <MemberFormHeader
        mode={mode}
        memberName={formData?.firstName && formData?.lastName 
          ? `${formData.firstName} ${formData.lastName}` 
          : 'Nouveau membre'
        }
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isSaving}
        hasErrors={Object.keys(validationErrors).length > 0}
      />

      {/* Contenu principal */}
      <div className="member-form-content">
        {/* Onglets de navigation */}
        <div className="tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {/* Indicateur d'erreur */}
              {validationErrors[tab.key] && (
                <span className="tab-error-indicator" />
              )}
            </button>
          ))}
        </div>

        {/* Contenu de l'onglet actif */}
        <div className="tab-content">
          {renderActiveTab()}
        </div>
      </div>

      {/* Modal pour la caméra */}
      <CameraModal
        isOpen={false} // Géré par les composants enfants
        onCapture={handlePhotoCapture}
        onClose={() => {}} // Géré par les composants enfants
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Chargement en cours...</p>
          </div>
        </div>
      )}

      {/* Alert modal */}
      {showAlert && (
        <div className="alert-overlay" onClick={() => setShowAlert(false)}>
          <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Information</h3>
            <p>{alertMessage}</p>
            <button 
              className="alert-ok-button"
              onClick={() => setShowAlert(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberForm;