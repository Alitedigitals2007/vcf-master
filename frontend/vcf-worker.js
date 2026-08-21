/* ==========================================================================
   ALITE VCF Manager - Client-Side VCF Processor (Web Worker)
   Handles 200MB+ files entirely in browser - no upload needed
   ========================================================================== */

// Phone Normalization (matches Python engine)
class PhoneNormalizer {
    constructor(formatType = 'international') {
        this.formatType = formatType;
    }

    normalize(phone) {
        if (!phone) return '';
        let cleaned = phone.replace(/[\s\-\(\)\.]/g, '').replace(/\+/g, '');
        if (cleaned.startsWith('234')) cleaned = cleaned.slice(3);
        if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
        return this.formatType === 'international' ? `+234${cleaned}` : `0${cleaned}`;
    }

    isNigerian(phone) {
        const normalized = phone.replace(/[\s\-\(\)\.\+]/g, '');
        return normalized.startsWith(('234,080,081,090,070,091,071,082,083,084,085,086,087,088,089,092,093,094,095,096,097,098,099').split(','));
    }
}

// VCF Contact class
class VCFContact {
    constructor(name = '', phones = [], emails = [], raw = '') {
        this.name = name;
        this.phones = phones;
        this.emails = emails;
        this.raw = raw;
        this.normalizedPhones = [];
        this.isDuplicate = false;
        this.duplicateGroup = null;
    }

    toDict() {
        return {
            name: this.name,
            phones: this.phones,
            emails: this.emails,
            normalizedPhones: this.normalizedPhones,
            isDuplicate: this.isDuplicate,
            duplicateGroup: this.duplicateGroup
        };
    }
}

// VCF Parser
class VCFParser {
    constructor(formatType = 'international') {
        this.normalizer = new PhoneNormalizer(formatType);
    }

    parse(content) {
        const contacts = [];
        const vcards = this.splitVCards(content);
        
        for (const vcard of vcards) {
            const contact = this.parseVCard(vcard);
            if (contact) contacts.push(contact);
        }
        return contacts;
    }

    splitVCards(content) {
        const cards = [];
        let current = '';
        const lines = content.split(/\r?\n/);
        
        for (const line of lines) {
            current += line + '\n';
            if (line.trim() === 'END:VCARD') {
                cards.push(current);
                current = '';
            }
        }
        if (current.trim()) cards.push(current);
        return cards;
    }

    parseVCard(vcard) {
        let name = '';
        const phones = [];
        const emails = [];
        const lines = vcard.split(/\r?\n/);
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            
            // Handle folded lines (continuation lines start with space/tab)
            let fullLine = line;
            while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
                i++;
                fullLine += lines[i].substring(1);
            }

            if (fullLine.startsWith('FN:') || fullLine.startsWith('FN;')) {
                name = fullLine.split(':').slice(1).join(':').trim();
            } else if (fullLine.startsWith('TEL') || fullLine.startsWith('TEL;')) {
                const value = fullLine.split(':').slice(1).join(':').trim();
                if (value) phones.push(value);
            } else if (fullLine.startsWith('EMAIL') || fullLine.startsWith('EMAIL;')) {
                const value = fullLine.split(':').slice(1).join(':').trim();
                if (value) emails.push(value);
            }
            i++;
        }

        const contact = new VCFContact(name, phones, emails, vcard);
        contact.normalizedPhones = phones.map(p => this.normalizer.normalize(p)).filter(p => p);
        return contact;
    }
}

// Duplicate Detector
class DuplicateDetector {
    constructor() {
        this.phoneToContacts = new Map();
        this.duplicateGroups = [];
    }

    detect(contacts) {
        this.phoneToContacts.clear();
        this.duplicateGroups = [];

        contacts.forEach((contact, idx) => {
            contact.normalizedPhones.forEach(phone => {
                if (!this.phoneToContacts.has(phone)) {
                    this.phoneToContacts.set(phone, []);
                }
                this.phoneToContacts.get(phone).push({ index: idx, contact });
            });
        });

        const stats = {
            totalContacts: contacts.length,
            uniqueNumbers: this.phoneToContacts.size,
            duplicateEntries: 0,
            duplicateNumbers: 0,
            mostDuplicated: []
        };

        let groupId = 0;
        for (const [phone, list] of this.phoneToContacts) {
            if (list.length > 1) {
                stats.duplicateNumbers++;
                stats.duplicateEntries += list.length;
                groupId++;
                list.forEach(({ contact }) => {
                    contact.isDuplicate = true;
                    contact.duplicateGroup = groupId;
                });
                this.duplicateGroups.push({
                    groupId,
                    phone,
                    count: list.length,
                    contacts: list.map(({ index, contact }) => ({
                        index,
                        name: contact.name,
                        phones: contact.phones
                    }))
                });
            }
        }

        stats.uniqueContacts = stats.totalContacts - stats.duplicateEntries + stats.duplicateNumbers;
        stats.mostDuplicated = Array.from(this.phoneToContacts.entries())
            .filter(([, v]) => v.length > 1)
            .map(([phone, list]) => ({ phone, count: list.length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return { stats, duplicateGroups: this.duplicateGroups };
    }

    getUniqueContacts(contacts, strategy = 'first') {
        const seen = new Set();
        const unique = [];
        
        for (const contact of contacts) {
            const key = contact.normalizedPhones.sort().join(',');
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(contact);
            } else if (strategy === 'last') {
                const idx = unique.findIndex(u => u.normalizedPhones.sort().join(',') === key);
                if (idx >= 0) unique[idx] = contact;
            }
        }
        return unique;
    }

    getDuplicateContacts(contacts) {
        return contacts.filter(c => c.isDuplicate);
    }
}

// Contact Renamer
class ContactRenamer {
    constructor(prefix = 'Contact', start = 1, padding = 4) {
        this.prefix = prefix;
        this.counter = start;
        this.padding = padding;
    }

    rename(contacts) {
        contacts.forEach(c => {
            c.name = `${this.prefix} ${String(this.counter).padStart(this.padding, '0')}`;
            this.counter++;
        });
        return contacts;
    }

    renameDuplicatesOnly(contacts) {
        const seen = new Set();
        contacts.forEach(c => {
            const key = c.normalizedPhones.sort().join(',');
            if (seen.has(key)) {
                c.name = `${this.prefix} ${String(this.counter).padStart(this.padding, '0')}`;
                this.counter++;
            } else {
                seen.add(key);
            }
        });
        return contacts;
    }
}

// VCF Generator
class VCFGenerator {
    static generate(contacts) {
        return contacts.map(contact => {
            let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
            vcard += `FN:${contact.name}\n`;
            contact.phones.forEach(phone => {
                vcard += `TEL;TYPE=CELL:${phone}\n`;
            });
            contact.emails.forEach(email => {
                vcard += `EMAIL;TYPE=INTERNET:${email}\n`;
            });
            vcard += 'END:VCARD\n';
            return vcard;
        }).join('\n');
    }
}

// Report Generator
class ReportGenerator {
    static generate(stats, duplicateGroups = []) {
        const lines = [
            'VCF CONTACT REPORT',
            '==============================',
            'Made by Alite | myalite.vercel.app',
            '',
            `Files processed:       ${stats.filesProcessed || 1}`,
            `Contacts found:        ${stats.totalContacts.toLocaleString()}`,
            `Unique contacts:       ${stats.uniqueContacts.toLocaleString()}`,
            `Duplicate entries:     ${stats.duplicateEntries.toLocaleString()}`,
            `Unique duplicated numbers: ${stats.duplicateNumbers.toLocaleString()}`,
            '',
            'Most duplicated numbers:',
                            '------------------------------'
        ];
        
        stats.mostDuplicated.forEach(item => {
            lines.push(`  ${item.phone} -> ${item.count} occurrences`);
        });

        if (duplicateGroups.length) {
            lines.push('', 'Duplicate Groups:', '------------------------------');
            duplicateGroups.forEach(group => {
                lines.push(`  Group ${group.groupId}: ${group.phone} (${group.count} contacts)`);
                group.contacts.forEach(c => {
                    lines.push(`    - ${c.name} (${c.phones.join(', ')})`);
                });
            });
        }

        return lines.join('\n');
    }
}

// Main Processor
class VCFProcessor {
    constructor(options = {}) {
        this.options = {
            formatType: options.formatType || 'international',
            namingPrefix: options.namingPrefix || 'Contact',
            detectDuplicates: options.detectDuplicates !== false,
            removeDuplicates: options.removeDuplicates !== false,
            renameContacts: options.renameContacts !== false,
            renameDuplicatesOnly: options.renameDuplicatesOnly !== false,
            duplicateStrategy: options.duplicateStrategy || 'first'
        };
    }

    async process(files, onProgress) {
        // files is now array of {name, content, size}
        let allContent = '';
        let totalSize = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            allContent += file.content + '\n';
            totalSize += file.size;
            if (onProgress) onProgress({ stage: 'reading', file: i + 1, total: files.length, bytes: totalSize });
        }

        // Parse
        const parser = new VCFParser(this.options.formatType);
        let contacts;
        try {
            contacts = parser.parse(allContent);
        } catch (e) {
            throw new Error('Failed to parse VCF content: ' + e.message);
        }
        if (onProgress) onProgress({ stage: 'parsed', count: contacts.length });

        // Detect duplicates
        const detector = new DuplicateDetector();
        const { stats, duplicateGroups } = detector.detect(contacts);
        stats.filesProcessed = files.length;
        if (onProgress) onProgress({ stage: 'duplicates', stats });

        // Rename if needed
        const renamer = new ContactRenamer(this.options.namingPrefix);
        if (this.options.renameContacts) {
            if (this.options.renameDuplicatesOnly) {
                renamer.renameDuplicatesOnly(contacts);
            } else {
                renamer.rename(contacts);
            }
        }

        // Get unique/duplicate sets
        const uniqueContacts = this.options.removeDuplicates 
            ? detector.getUniqueContacts(contacts, this.options.duplicateStrategy)
            : contacts;
        const duplicateContacts = detector.getDuplicateContacts(contacts);

        // Generate outputs
        const allVcf = VCFGenerator.generate(contacts);
        const uniqueVcf = VCFGenerator.generate(uniqueContacts);
        const duplicatesVcf = VCFGenerator.generate(duplicateContacts);
        const report = ReportGenerator.generate(stats, duplicateGroups);

        if (onProgress) onProgress({ stage: 'complete' });

        return {
            stats,
            contacts: contacts.map(c => c.toDict()),
            uniqueContacts: uniqueContacts.map(c => c.toDict()),
            duplicateContacts: duplicateContacts.map(c => c.toDict()),
            allVcf,
            uniqueVcf,
            duplicatesVcf,
            report
        };
    }

    readFile(file) {
        }

// Web Worker Interface
self.onmessage = async function(e) {
    const { files, options } = e.data;
    
    try {
        console.log('Worker received', files.length, 'files');
        // Immediate response to confirm worker is alive
        self.postMessage({ type: 'progress', data: { stage: 'starting', percent: 5, text: 'Worker started' }});
        const processor = new VCFProcessor(options);
        const result = await processor.process(files, (progress) => {
            self.postMessage({ type: 'progress', data: progress });
        });
        console.log('Worker complete:', result.stats.totalContacts, 'contacts');
        self.postMessage({ type: 'complete', data: result });
    } catch (error) {
        console.error('Worker processing error:', error);
        self.postMessage({ type: 'error', error: error.message + ' (stack: ' + error.stack + ')' });
    }
};

// Catch any unhandled errors in worker
self.onerror = function(err) {
    console.error('Worker unhandled error:', err);
    self.postMessage({ type: 'error', error: 'Unhandled: ' + (err.message || err) });
    return true;
};

self.addEventListener('unhandledrejection', function(event) {
    console.error('Worker unhandled rejection:', event.reason);
    self.postMessage({ type: 'error', error: 'Unhandled rejection: ' + event.reason });
});