// src/utils/invitationService.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

export const inviteMember = async (memberId, email = null) => {
  try {
    console.log('🚀 Début invitation pour membre:', memberId);
    
    // 1. Récupérer les données du membre
    const { data: member, error: fetchError } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single();

    console.log('📥 Membre récupéré:', member);
    if (fetchError) {
      console.error('❌ Erreur fetch:', fetchError);
      throw fetchError;
    }

    // 2. Vérifier si un email est fourni
    const memberEmail = email || member.email;
    if (!memberEmail) {
      throw new Error('Aucun email fourni pour ce membre');
    }

    // 3. Vérifier si le membre n'a pas déjà un compte
    if (member.user_id) {
      throw new Error('Ce membre a déjà un compte utilisateur');
    }

    // 4. Générer un token unique
    const invitationToken = 'inv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    console.log('🎫 Token généré:', invitationToken);

    // 5. Mettre à jour le membre avec les données d'invitation
    console.log('💾 Tentative UPDATE...');
    const { error: updateError } = await supabase
      .from('members')
      .update({
        email: memberEmail,
        invitation_status: 'pending',
        invitation_token: invitationToken,
        invited_at: new Date().toISOString()
      })
      .eq('id', memberId);

    console.log('✅ UPDATE terminé, erreur?', updateError);
    
    if (updateError) {
      console.error('❌ Erreur UPDATE:', updateError);
      throw updateError;
    }

    // 6. Envoyer l'invitation via votre Edge Function
    console.log('📧 Envoi email...');
    const { data, error: emailError } = await supabase.functions.invoke('invitation-sender', {
      body: {
        email: memberEmail,
        memberName: `${member.firstName} ${member.name}`,
        memberId: member.id,
        badgeId: member.badgeId,
        invitationToken: invitationToken,
        clubName: 'BodyForce'
      }
    });

    console.log('📬 Email envoyé, erreur?', emailError);
    
    if (emailError) throw emailError;

    // Créer l'objet updatedMember avec les nouvelles valeurs
    const updatedMember = {
      ...member,
      email: memberEmail,
      invitation_status: 'pending',
      invitation_token: invitationToken,
      invited_at: new Date().toISOString()
    };

    console.log('✅ Invitation réussie !');
    return {
      success: true,
      member: updatedMember,
      message: `Invitation envoyée à ${memberEmail}`
    };

  } catch (error) {
    console.error('💥 Erreur invitation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const resendInvitation = async (memberId) => {
  try {
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (error) throw error;

    if (member.invitation_status !== 'pending') {
      throw new Error('Aucune invitation en attente pour ce membre');
    }

    // Vérifier si l'invitation n'est pas trop récente (éviter le spam)
    const invitedAt = new Date(member.invited_at);
    const now = new Date();
    const minutesDiff = (now - invitedAt) / (1000 * 60);

    if (minutesDiff < 5) {
      throw new Error('Veuillez attendre 5 minutes avant de renvoyer une invitation');
    }

    const { error: emailError } = await supabase.functions.invoke('invitation-sender', {
      body: {
        email: member.email,
        memberName: `${member.firstName} ${member.name}`,
        memberId: member.id,
        badgeId: member.badgeId,
        invitationToken: member.invitation_token,
        clubName: 'BodyForce',
        isResend: true
      }
    });

    if (emailError) throw emailError;

    // Mettre à jour la date d'envoi
    const { error: updateError } = await supabase
      .from('members')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', memberId);

    if (updateError) throw updateError;

    return {
      success: true,
      message: 'Invitation renvoyée avec succès'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const cancelInvitation = async (memberId) => {
  try {
    const { error } = await supabase
      .from('members')
      .update({
        invitation_status: 'not_invited',
        invitation_token: null,
        invited_at: null
      })
      .eq('id', memberId);

    if (error) throw error;

    return {
      success: true,
      message: 'Invitation annulée'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};