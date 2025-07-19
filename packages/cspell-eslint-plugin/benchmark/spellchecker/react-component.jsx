import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

/**
 * UserProfile Component
 * 
 * A comprehensive user profile component that displays user information,
 * allows editing, and handles various user interactions.
 */
const UserProfile = ({ userId, isEditable = false, onUpdate, onError }) => {
    // State management
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [errors, setErrors] = useState({});
    
    // Internationalization
    const { t } = useTranslation();
    
    // Load user data on mount or userId change
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`/api/users/${userId}`);
                
                if (!response.ok) {
                    throw new Error('Failed to fetch user data');
                }
                
                const userData = await response.json();
                setUser(userData);
                setFormData(userData);
            } catch (error) {
                console.error('Error loading user:', error);
                onError?.(error);
            } finally {
                setIsLoading(false);
            }
        };
        
        if (userId) {
            fetchUserData();
        }
    }, [userId, onError]);
    
    // Handle form input changes
    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
        
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null,
            }));
        }
    }, [errors]);
    
    // Validate form data
    const validateForm = useCallback(() => {
        const newErrors = {};
        
        if (!formData.firstName?.trim()) {
            newErrors.firstName = t('validation.required', { field: 'First name' });
        }
        
        if (!formData.lastName?.trim()) {
            newErrors.lastName = t('validation.required', { field: 'Last name' });
        }
        
        if (!formData.email?.trim()) {
            newErrors.email = t('validation.required', { field: 'Email' });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = t('validation.invalidEmail');
        }
        
        if (formData.phone && !/^\+?[\d\s-()]+$/.test(formData.phone)) {
            newErrors.phone = t('validation.invalidPhone');
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, t]);
    
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            
            if (!response.ok) {
                throw new Error('Failed to update user');
            }
            
            const updatedUser = await response.json();
            setUser(updatedUser);
            setIsEditing(false);
            onUpdate?.(updatedUser);
            
            // Show success message
            alert(t('messages.updateSuccess'));
        } catch (error) {
            console.error('Error updating user:', error);
            onError?.(error);
            alert(t('messages.updateError'));
        }
    };
    
    // Cancel editing
    const handleCancel = useCallback(() => {
        setFormData(user);
        setErrors({});
        setIsEditing(false);
    }, [user]);
    
    // Memoized computed values
    const fullName = useMemo(() => {
        if (!user) return '';
        return `${user.firstName} ${user.lastName}`.trim();
    }, [user]);
    
    const memberSince = useMemo(() => {
        if (!user?.createdAt) return '';
        return new Date(user.createdAt).toLocaleDateString();
    }, [user]);
    
    // Loading state
    if (isLoading) {
        return (
            <div className="profile-loading">
                <div className="spinner" />
                <p>{t('loading.user')}</p>
            </div>
        );
    }
    
    // Error state
    if (!user) {
        return (
            <div className="profile-error">
                <p>{t('errors.userNotFound')}</p>
            </div>
        );
    }
    
    // Render profile
    return (
        <div className="user-profile">
            <div className="profile-header">
                <img 
                    src={user.avatar || '/default-avatar.png'} 
                    alt={`${fullName}'s avatar`}
                    className="profile-avatar"
                />
                <h1>{fullName}</h1>
                <p className="profile-subtitle">{user.bio || t('profile.noBio')}</p>
            </div>
            
            <div className="profile-content">
                {isEditing ? (
                    <form onSubmit={handleSubmit} className="profile-form">
                        <div className="form-group">
                            <label htmlFor="firstName">
                                {t('fields.firstName')}
                                <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName || ''}
                                onChange={handleInputChange}
                                className={errors.firstName ? 'error' : ''}
                                aria-invalid={!!errors.firstName}
                                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                            />
                            {errors.firstName && (
                                <span id="firstName-error" className="error-message">
                                    {errors.firstName}
                                </span>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="lastName">
                                {t('fields.lastName')}
                                <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName || ''}
                                onChange={handleInputChange}
                                className={errors.lastName ? 'error' : ''}
                            />
                            {errors.lastName && (
                                <span className="error-message">{errors.lastName}</span>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="email">
                                {t('fields.email')}
                                <span className="required">*</span>
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email || ''}
                                onChange={handleInputChange}
                                className={errors.email ? 'error' : ''}
                            />
                            {errors.email && (
                                <span className="error-message">{errors.email}</span>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="phone">{t('fields.phone')}</label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone || ''}
                                onChange={handleInputChange}
                                className={errors.phone ? 'error' : ''}
                            />
                            {errors.phone && (
                                <span className="error-message">{errors.phone}</span>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="bio">{t('fields.bio')}</label>
                            <textarea
                                id="bio"
                                name="bio"
                                value={formData.bio || ''}
                                onChange={handleInputChange}
                                rows={4}
                                maxLength={500}
                            />
                            <span className="char-count">
                                {formData.bio?.length || 0}/500
                            </span>
                        </div>
                        
                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                {t('actions.save')}
                            </button>
                            <button 
                                type="button" 
                                onClick={handleCancel}
                                className="btn btn-secondary"
                            >
                                {t('actions.cancel')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="profile-info">
                        <div className="info-section">
                            <h2>{t('profile.contactInfo')}</h2>
                            <dl>
                                <dt>{t('fields.email')}:</dt>
                                <dd>{user.email}</dd>
                                
                                {user.phone && (
                                    <>
                                        <dt>{t('fields.phone')}:</dt>
                                        <dd>{user.phone}</dd>
                                    </>
                                )}
                                
                                {user.location && (
                                    <>
                                        <dt>{t('fields.location')}:</dt>
                                        <dd>{user.location}</dd>
                                    </>
                                )}
                            </dl>
                        </div>
                        
                        <div className="info-section">
                            <h2>{t('profile.accountInfo')}</h2>
                            <dl>
                                <dt>{t('fields.username')}:</dt>
                                <dd>{user.username}</dd>
                                
                                <dt>{t('fields.memberSince')}:</dt>
                                <dd>{memberSince}</dd>
                                
                                <dt>{t('fields.accountType')}:</dt>
                                <dd>{user.accountType || 'Standard'}</dd>
                            </dl>
                        </div>
                        
                        {isEditable && (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="btn btn-primary"
                            >
                                {t('actions.editProfile')}
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Additional sections */}
            <div className="profile-stats">
                <h2>{t('profile.statistics')}</h2>
                <div className="stats-grid">
                    <div className="stat-item">
                        <span className="stat-value">{user.postsCount || 0}</span>
                        <span className="stat-label">{t('stats.posts')}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{user.followersCount || 0}</span>
                        <span className="stat-label">{t('stats.followers')}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{user.followingCount || 0}</span>
                        <span className="stat-label">{t('stats.following')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// PropTypes validation
UserProfile.propTypes = {
    userId: PropTypes.string.isRequired,
    isEditable: PropTypes.bool,
    onUpdate: PropTypes.func,
    onError: PropTypes.func,
};

// Default props
UserProfile.defaultProps = {
    isEditable: false,
    onUpdate: null,
    onError: null,
};

export default UserProfile;