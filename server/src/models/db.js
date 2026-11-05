let dotenv = require("dotenv")
dotenv.config()
let mongoose = require('mongoose')
const dns = require('dns');
const User = require('./User');

function mongoConnection() {
    // Use Google DNS to resolve SRV records — some local ISP DNS servers
    // refuse SRV queries from Node.js, causing mongodb+srv:// to fail.
    try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) { /* ignore */ }

    mongoose.connect(process.env.MONGODB_URI)
        .then(async () => {
            console.log("MongoDB Connected..");
            try {
                console.log('[Migration] Checking for users without a username...');
                const usersLackingUsername = await User.find({ username: { $exists: false } });
                if (usersLackingUsername.length > 0) {
                    console.log(`[Migration] Found ${usersLackingUsername.length} user(s) lacking a username. Migrating...`);
                    for (const u of usersLackingUsername) {
                        let baseName = (u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (!baseName || baseName.length < 3) baseName = 'user';
                        let candidate = baseName;
                        let suffix = 1;
                        while (await User.exists({ username: candidate })) {
                            candidate = `${baseName}${suffix}`;
                            suffix++;
                        }
                        u.username = candidate;
                        await u.save();
                        console.log(`[Migration] Set username '${candidate}' for user '${u.name}' (${u._id})`);
                    }
                    console.log('[Migration] Username migration completed.');
                } else {
                    console.log('[Migration] No users lacking username found.');
                }

                // Seed/update teacher credentials for demo teachers if missing
                const seedTeacherProfiles = {
                    'rahul verma': {
                        languages: ['English', 'Hindi'],
                        qualifications: ["Bachelor's Degree", 'B.Ed / D.El.Ed'],
                        isCertified: true,
                        certifications: [
                            { id: 'seed-cert-1', title: 'CTET Qualified' },
                            { id: 'seed-cert-2', title: 'AWS Certified Solutions Architect' },
                        ],
                        yearsTeaching: '3–5 years',
                        careerHistory: [
                            { id: 'seed-career-1', role: 'Senior React Developer', organization: 'TCS', years: '3 years' },
                            { id: 'seed-career-2', role: 'Coding Tutor', organization: 'Private', years: '2 years' },
                        ],
                        privateTuition: true,
                    },
                    'ananya reddy': {
                        languages: ['English', 'Hindi', 'Telugu'],
                        qualifications: ["Master's Degree", 'Professional Certification'],
                        isCertified: true,
                        certifications: [
                            { id: 'seed-cert-3', title: 'Certified Culinary Arts Instructor' },
                            { id: 'seed-cert-4', title: 'Level 3 Food Safety & Hygiene' },
                        ],
                        yearsTeaching: '5–10 years',
                        careerHistory: [
                            { id: 'seed-career-3', role: 'Head Chef', organization: 'Spice Garden', years: '4 years' },
                            { id: 'seed-career-4', role: 'Culinary Workshop Lead', organization: 'Self-Employed', years: '3 years' },
                        ],
                        privateTuition: true,
                    },
                    'arjun mehta': {
                        languages: ['English', 'Hindi', 'Gujarati'],
                        qualifications: ["Bachelor's Degree", 'Diploma'],
                        isCertified: true,
                        certifications: [
                            { id: 'seed-cert-5', title: 'ABRSM Grade 8 Piano' },
                            { id: 'seed-cert-6', title: 'Classical Guitar Performance Dip.' },
                        ],
                        yearsTeaching: '1–3 years',
                        careerHistory: [
                            { id: 'seed-career-5', role: 'Music Instructor', organization: 'Sangeet Academy', years: '2 years' },
                        ],
                        privateTuition: true,
                    },
                };

                for (const [name, prof] of Object.entries(seedTeacherProfiles)) {
                    const found = await User.findOne({ name: new RegExp(`^${name}$`, 'i') });
                    if (found && (!found.teacherProfile || !found.teacherProfile.qualifications || found.teacherProfile.qualifications.length === 0)) {
                        found.teacherProfile = prof;
                        await found.save();
                        console.log(`[Migration] Seeded teacher credentials for ${found.name}`);
                    }
                }
            } catch (err) {
                console.error('[Migration] Failed running username or teacher migration:', err);
            }
        })
        .catch((err) => {
            console.log(err);
        })
}

module.exports = mongoConnection