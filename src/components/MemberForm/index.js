import React, { useState } from 'react';
import { 
  IonContent, 
  IonHeader, 
  IonPage, 
  IonTabBar, 
  IonTabButton, 
  IonIcon, 
  IonLabel,
  IonTabs,
  IonRouterOutlet,
  IonAlert,
  IonLoading
} from '@ionic/react';
import { 
  personOutline, 
  mailOutline, 
  cardOutline, 
  documentOutline, 
  walletOutline 
} from 'ionicons/icons';

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
  
  // Utilisation du hook personnalisé pour la logique métier
  const {
    formData,
    errors,
    isLoading,
    isSaving,
    showAlert,
    alertMessage,
    validationErrors,
    updateFormData,
    validateForm,
    saveForm,
    resetForm,
    setShowAlert,
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
      icon: personOutline,
      label: 'Identité',
      component: IdentityTab
    },
    {
      key: 'contact',
      icon: mailOutline,
      label: 'Contact',
      component: ContactTab
    },
    {
      key: 'subscription',
      icon: cardOutline,
      label: 'Adhésion',
      component: SubscriptionTab
    },
    {
      key: 'documents',
      icon: documentOutline,
      label: 'Documents',
      component: DocumentsTab
    },
    {
      key: 'payments',
      icon: walletOutline,
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
    <IonPage>
      <IonHeader>
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
      </IonHeader>

      <IonContent>
        <IonTabs>
          <IonRouterOutlet>
            <div className="tab-content">
              {renderActiveTab()}
            </div>
          </IonRouterOutlet>

          <IonTabBar slot="bottom">
            {tabs.map((tab) => (
              <IonTabButton
                key={tab.key}
                tab={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={activeTab === tab.key ? 'tab-selected' : ''}
              >
                <IonIcon 
                  icon={tab.icon} 
                  color={activeTab === tab.key ? 'primary' : 'medium'} 
                />
                <IonLabel color={activeTab === tab.key ? 'primary' : 'medium'}>
                  {tab.label}
                </IonLabel>
                {/* Indicateur d'erreur sur l'onglet */}
                {validationErrors[tab.key] && (
                  <div className="tab-error-indicator" />
                )}
              </IonTabButton>
            ))}
          </IonTabBar>
        </IonTabs>

        {/* Modal pour la caméra */}
        <CameraModal
          isOpen={false} // Géré par les composants enfants
          onCapture={handlePhotoCapture}
          onClose={() => {}} // Géré par les composants enfants
        />

        {/* Loading global */}
        <IonLoading
          isOpen={isLoading}
          message="Chargement en cours..."
          duration={0}
        />

        {/* Alert pour les messages */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Information"
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default MemberForm;