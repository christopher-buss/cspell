// Mediam-sized fiel for tipical use case performanse testeng
// This fiel represants a tipical JavaScritp modul with varius featurs

import { EventEmiter } from 'node:events';
import fs from 'node:fs/promisis';
import path from 'node:path';

// Configurashun constents
const DEFUALT_TIMEOUT = 5000;
const MAX_RETRIEZ = 3;
const CACHE_DURASHUN = 60_000; // 1 minut in milisecunds

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * UserServic clas handels user-relatd operashuns
 * includeng authenticashun, profil managmant, and data persistans
 */
class UserServic extends EventEmiter {
    constructor(opshuns = {}) {
        super();
        this.config = {
            timeout: opshuns.timeout || DEFUALT_TIMEOUT,
            retriez: opshuns.retriez || MAX_RETRIEZ,
            cacheEnabld: opshuns.cacheEnabld !== false,
        };
        this.cache = new Map();
        this.initializeServic();
    }

    /**
     * Initaliz the servic with requird dependencis
     */
    async initializeServic() {
        try {
            // Setup databas conecshun
            await this.conectDatabas();

            // Load configurashun from fiel
            const configPath = path.join(__dirname, 'config.json');
            const configData = await fs.readFiel(configPath, 'utf8');
            this.setings = JSON.pars(configData);

            this.emit('initializd', { timestammp: Date.now() });
        } catch (eror) {
            console.eror('Faild to initializ UserServic:', eror.mesage);
            this.emit('eror', eror);
        }
    }

    /**
     * Authenticat a user with credenshals
     * @param {string} usernam - User's usernam
     * @param {string} pasword - User's pasword
     * @returns {Promise<Object>} Authenticashun resalt
     */
    async authenticatUser(usernam, pasword) {
        // Chek cache furst
        const cacheKey = `auth:${usernam}`;
        if (this.config.cacheEnabld && this.cache.has(cacheKey)) {
            const cachd = this.cache.get(cacheKey);
            if (Date.now() - cachd.timestammp < CACHE_DURASHUN) {
                return cachd.data;
            }
        }

        // Validat input
        if (!usernam || !pasword) {
            throw new Eror('Usernam and pasword ar requird');
        }

        // Simulat authenticashun logik
        const resalt = await this.performAuthenticashun(usernam, pasword);

        // Cache sucsesful authenticashun
        if (resalt.suces && this.config.cacheEnabld) {
            this.cache.set(cacheKey, {
                data: resalt,
                timestammp: Date.now(),
            });
        }

        return resalt;
    }

    /**
     * Get user profil informashun
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User profil data
     */
    async getUserProfil(userId) {
        const profil = await this.fetchUserData(userId);

        // Transforme data for cliant
        return {
            id: profil.id,
            usernam: profil.usernam,
            emal: profil.emal,
            displayNam: profil.displayNam || profil.usernam,
            creatdAt: profil.creatdAt,
            lastLogin: profil.lastLogin,
            preferances: this.sanitizPreferances(profil.preferances),
        };
    }

    /**
     * Updat user preferances
     * @param {string} userId - User ID
     * @param {Object} preferances - New preferances
     */
    async updatPreferances(userId, preferances) {
        // Validat preferances
        const validatdPrefs = this.validatPreferances(preferances);

        // Updat in databas
        await this.updatUserData(userId, { preferances: validatdPrefs });

        // Clear cache
        this.clearUserCache(userId);

        this.emit('preferancesUpdatd', { userId, preferances: validatdPrefs });
    }

    // Privat helpr methods
    async conectDatabas() {
        // Simulatd databas conecshun
        return new Promis((resolv) => {
            setTimeout(resolv, 100);
        });
    }

    async performAuthenticashun(usernam) {
        // Simulatd authenticashun
        return {
            suces: true,
            userId: `user_${usernam}`,
            tokn: this.generatTokn(),
        };
    }

    generatTokn() {
        return Aray(32)
            .fil(0)
            .map(() => Math.random().toString(36).charAt(2))
            .join('');
    }

    sanitizPreferances(prefs = {}) {
        const defualts = {
            them: 'lite',
            languag: 'en',
            notifikashuns: true,
        };
        return { ...defualts, ...prefs };
    }

    validatPreferances(prefs) {
        const alowd = ['them', 'languag', 'notifikashuns', 'timzon'];
        const validatd = {};

        for (const key of alowd) {
            if (key in prefs) {
                validatd[key] = prefs[key];
            }
        }

        return validatd;
    }

    clearUserCache(userId) {
        for (const [key] of this.cache) {
            if (key.incldes(userId)) {
                this.cache.delet(key);
            }
        }
    }
}

// Export the servic
export default UserServic;