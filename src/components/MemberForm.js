import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseServices } from '../supabaseClient';
import { User, Calendar, CreditCard, Phone, Mail, MapPin, Users, 
         Save, X, Upload, Trash2, Eye, EyeOff, AlertCircle, 
         CheckCircle, Camera, FileText, UserCheck, UserX, 
         ArrowLeft, Loader2, Star } from 'lucide-react';

const MemberForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [member, setMember] = useState({
    name: '',
    firstName: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    gender: '',
    badgeId: '',
    startDate: '',
    endDate: '',
    etudiant: false,
    notes: '',
    files: []
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (isEdit) {
      loadMember();
    }
  }, [id, isEdit]);

  const loadMember = async () => {
    try {
      setLoading(true);
      const data = await supabaseServices.getMemberById(id);
      if (data) {
        setMember({
          ...data,
          birthDate: data.birthDate ? data.birthDate.split('T')[0] : '',
          startDate: data.startDate ? data.startDate.split('T')[0] : '',
          endDate: data.endDate ? data.endDate.split('T')[0] : '',
          files: data.files || []
        });
      }
    } catch (error) {
      setErrors({ general: 'Erreur lors du chargement du membre' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMember(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!member.name.trim()) newErrors.name = 'Le nom est requis';
    if (!member.firstName.trim()) newErrors.firstName = 'Le prénom est requis';
    if (member.email && !/\S+@\S+\.\S+/.test(member.email)) {
      newErrors.email = 'Email invalide';
    }
    if (member.phone && !/^\d{10}$/.test(member.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Numéro de téléphone invalide (10 chiffres)';
    }
    if (!member.badgeId.trim()) newErrors.badgeId = 'L\'ID du badge est requis';
    if (!member.startDate) newErrors.startDate = 'La date de début est requise';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      setErrors({});
      
      const memberData = {
        ...member,
        phone: member.phone.replace(/\s/g, ''),
      };

      if (isEdit) {
        await supabaseServices.updateMember(id, memberData);
        setSuccessMessage('Membre mis à jour avec succès !');
      } else {
        await supabaseServices.createMember(memberData);
        setSuccessMessage('Membre créé avec succès !');
      }

      setTimeout(() => {
        navigate('/members');
      }, 1500);

    } catch (error) {
      setErrors({ general: error.message || 'Une erreur est survenue' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    // Implementation would go here for file upload
    console.log('Files to upload:', files);
  };

  const tabs = [
    { id: 'personal', label: 'Informations personnelles', icon: User },
    { id: 'membership', label: 'Adhésion', icon: UserCheck },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'files', label: 'Documents', icon: FileText }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/members')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 
                         rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  {isEdit ? 'Modifier le membre' : 'Nouveau membre'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {isEdit ? `Modification de ${member.firstName} ${member.name}` : 
                   'Ajouter un nouveau membre à votre organisation'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.etudiant && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  Étudiant
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-medium">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors 
                                flex items-center gap-2 ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {/* Personal Information Tab */}
              {activeTab === 'personal' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom de famille *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={member.name}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  focus:border-blue-500 transition-colors ${
                          errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Entrez le nom de famille"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={member.firstName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  focus:border-blue-500 transition-colors ${
                          errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Entrez le prénom"
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.firstName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date de naissance
                      </label>
                      <input
                        type="date"
                        name="birthDate"
                        value={member.birthDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 
                                 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Genre
                      </label>
                      <select
                        name="gender"
                        value={member.gender}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 
                                 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value="">Sélectionnez le genre</option>
                        <option value="Homme">Homme</option>
                        <option value="Femme">Femme</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ID Badge *
                      </label>
                      <input
                        type="text"
                        name="badgeId"
                        value={member.badgeId}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  focus:border-blue-500 transition-colors ${
                          errors.badgeId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Entrez l'ID du badge"
                      />
                      {errors.badgeId && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.badgeId}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adresse
                      </label>
                      <textarea
                        name="address"
                        value={member.address}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 
                                 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Entrez l'adresse complète"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes personnelles
                      </label>
                      <textarea
                        name="notes"
                        value={member.notes}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 
                                 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Notes supplémentaires sur le membre..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Membership Tab */}
              {activeTab === 'membership' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date de début d'adhésion *
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={member.startDate}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                  focus:border-blue-500 transition-colors ${
                          errors.startDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {errors.startDate && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.startDate}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date de fin d'adhésion
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={member.endDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 
                                 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Star className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-900">
                              Statut étudiant
                            </label>
                            <p className="text-sm text-gray-600">
                              Membre bénéficiant du tarif étudiant
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="etudiant"
                            checked={member.etudiant}
                            onChange={handleInputChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
                                        peer-focus:ring-blue-300 rounded-full peer 
                                        peer-checked:after:translate-x-full peer-checked:after:border-white 
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                                        after:bg-white after:border-gray-300 after:border after:rounded-full 
                                        after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-900 mb-2">
                        Informations sur l'adhésion
                      </h3>
                      <div className="space-y-2 text-sm text-blue-800">
                        <p>• Durée d'adhésion calculée automatiquement</p>
                        <p>• Notifications de renouvellement automatiques</p>
                        <p>• Historique des paiements accessible</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Tab */}
              {activeTab === 'contact' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adresse email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={member.email}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                    focus:border-blue-500 transition-colors ${
                            errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="exemple@email.com"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numéro de téléphone
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          name="phone"
                          value={member.phone}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 
                                    focus:border-blue-500 transition-colors ${
                            errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="06 12 34 56 78"
                        />
                      </div>
                      {errors.phone && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">
                          Informations de contact
                        </h3>
                      </div>
                      <div className="space-y-3 text-sm text-gray-600">
                        <p>• Email : {member.email || 'Non renseigné'}</p>
                        <p>• Téléphone : {member.phone || 'Non renseigné'}</p>
                        <p>• Adresse : {member.address || 'Non renseignée'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <div className="flex flex-col items-center">
                      <Upload className="w-12 h-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Ajouter des documents
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Glissez-déposez vos fichiers ici ou cliquez pour sélectionner
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      />
                      <label
                        htmlFor="file-upload"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 
                                 rounded-lg cursor-pointer transition-colors flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Choisir des fichiers
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        PDF, DOC, DOCX, JPG, PNG (max 10MB par fichier)
                      </p>
                    </div>
                  </div>

                  {member.files && member.files.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">
                        Documents existants ({member.files.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {member.files.map((file, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="w-8 h-8 text-blue-600" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.name || `Document ${index + 1}`}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {file.size || 'Taille inconnue'}
                                  </p>
                                </div>
                              </div>
                              <button className="text-gray-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <button
                type="button"
                onClick={() => navigate('/members')}
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 
                         font-medium rounded-lg hover:bg-gray-50 transition-colors 
                         flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 
                         disabled:bg-blue-400 text-white font-medium rounded-lg 
                         transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEdit ? 'Modification...' : 'Création...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isEdit ? 'Mettre à jour' : 'Créer le membre'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberForm;