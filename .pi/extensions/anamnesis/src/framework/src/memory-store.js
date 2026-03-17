/**
 * Memory Store - Markdown file I/O for the Continuity Framework
 * @module continuity/memory-store
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { generateId } from './types.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  basePath: join(process.cwd(), '.agents', 'experience', 'memory'),
  memoryFile: 'MEMORY.md',
  questionsFile: 'questions.md',
  identityFile: 'identity.md',
  predictionsFile: 'predictions.md',
  reflectionsDir: 'reflections'
};

/**
 * MemoryStore - Handles reading and writing memories to markdown files
 */
export class MemoryStore {
  /**
   * @param {Object} config - Store configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
  }

  /**
   * Initialize the memory store (create directories if needed)
   */
  async init() {
    const dirs = [
      this.config.basePath,
      join(this.config.basePath, this.config.reflectionsDir)
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    this.initialized = true;
  }

  /**
   * Get full path to a file
   * @param {string} filename - File name
   * @returns {string} Full path
   */
  _path(filename) {
    return join(this.config.basePath, filename);
  }

  // ============================================
  // Questions Management
  // ============================================

  /**
   * Load pending questions from file
   * @returns {Promise<Object[]>} Array of questions
   */
  async loadQuestions() {
    const path = this._path(this.config.questionsFile);

    if (!existsSync(path)) {
      return [];
    }

    const content = await readFile(path, 'utf-8');
    return this._parseQuestionsMarkdown(content);
  }

  /**
   * Save questions to file
   * @param {Object[]} questions - Questions to save
   */
  async saveQuestions(questions) {
    const path = this._path(this.config.questionsFile);
    const content = this._formatQuestionsMarkdown(questions);
    await writeFile(path, content, 'utf-8');
  }

  /**
   * Add a question to the pending list
   * @param {Object} question - Question to add
   */
  async addQuestion(question) {
    const questions = await this.loadQuestions();

    // Ensure ID
    if (!question.id) {
      question.id = generateId('q');
    }

    // Check for duplicates
    const exists = questions.some(q =>
      q.question.toLowerCase() === question.question.toLowerCase()
    );

    if (!exists) {
      questions.push({
        ...question,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      await this.saveQuestions(questions);
    }

    return question;
  }

  /**
   * Mark a question as resolved
   * @param {string} questionId - Question ID
   * @param {Object} resolution - Resolution details
   */
  async resolveQuestion(questionId, resolution = {}) {
    const questions = await this.loadQuestions();
    const idx = questions.findIndex(q => q.id === questionId);

    if (idx >= 0) {
      questions[idx] = {
        ...questions[idx],
        status: resolution.skipped ? 'skipped' : 'answered',
        answered_at: new Date().toISOString(),
        answer_summary: resolution.summary || null,
        skip_reason: resolution.skip_reason || null
      };
      await this.saveQuestions(questions);
    }

    return questions[idx];
  }

  /**
   * Get questions for surfacing at session start
   * @param {number} limit - Maximum questions to return
   * @returns {Promise<Object[]>} Prioritized questions
   */
  async getQuestionsToSurface(limit = 3) {
    const questions = await this.loadQuestions();

    return questions
      .filter(q => q.status === 'pending')
      .filter(q => q.timing === 'next_session' || q.timing === 'when_relevant')
      .sort((a, b) => (b.curiosity_score || 0) - (a.curiosity_score || 0))
      .slice(0, limit);
  }

  // ============================================
  // Predictions Management
  // ============================================

  /**
   * Load predictions from file
   * @returns {Promise<Object[]>} Array of predictions
   */
  async loadPredictions() {
    const path = this._path(this.config.predictionsFile);
    if (!existsSync(path)) return [];
    const content = await readFile(path, 'utf-8');
    return this._parsePredictionsMarkdown(content);
  }

  /**
   * Save predictions to file
   * @param {Object[]} predictions - Predictions to save
   */
  async savePredictions(predictions) {
    const path = this._path(this.config.predictionsFile);
    const content = this._formatPredictionsMarkdown(predictions);
    await writeFile(path, content, 'utf-8');
  }

  /**
   * Add predictions to the store
   * @param {Object[]} newPredictions - Predictions to add
   * @returns {Promise<Object[]>} Added predictions
   */
  async addPredictions(newPredictions) {
    const existing = await this.loadPredictions();
    for (const pred of newPredictions) {
      if (!pred.id) pred.id = generateId('pred');
      pred.planted = pred.planted || new Date().toISOString().split('T')[0];
      pred.status = pred.status || 'pending';
      existing.push(pred);
    }
    await this.savePredictions(existing);
    return newPredictions;
  }

  // ============================================
  // Memory Management
  // ============================================

  /**
   * Load memories from file
   * @returns {Promise<Object[]>} Array of memories
   */
  async loadMemories() {
    const path = this._path(this.config.memoryFile);

    if (!existsSync(path)) {
      return [];
    }

    const content = await readFile(path, 'utf-8');
    return this._parseMemoriesMarkdown(content);
  }

  /**
   * Save memories to file
   * @param {Object[]} memories - Memories to save
   */
  async saveMemories(memories) {
    const path = this._path(this.config.memoryFile);
    const content = this._formatMemoriesMarkdown(memories);
    await writeFile(path, content, 'utf-8');
  }

  /**
   * Add memories to the store
   * @param {Object[]} newMemories - Memories to add
   * @returns {Promise<Object[]>} Added memories
   */
  async addMemories(newMemories) {
    const existing = await this.loadMemories();

    const added = [];
    for (const memory of newMemories) {
      // Ensure ID
      if (!memory.id) {
        memory.id = generateId('mem');
      }

      // Check for duplicates by content similarity
      const duplicate = existing.some(m =>
        m.content.toLowerCase() === memory.content.toLowerCase()
      );

      if (!duplicate) {
        memory.created_at = memory.created_at || new Date().toISOString();
        existing.push(memory);
        added.push(memory);
      }
    }

    if (added.length > 0) {
      await this.saveMemories(existing);
    }

    return added;
  }

  /**
   * Evolve memories against existing store (A-MEM pattern)
   * Compares new memories to existing ones, detecting contradictions and reinforcements.
   * @param {Object[]} newMemories - Memories to evolve
   * @returns {Promise<{added: Object[], superseded: Object[], reinforced: Object[]}>}
   */
  async evolveMemories(newMemories) {
    const existing = await this.loadMemories();
    const added = [];
    const superseded = [];
    const reinforced = [];
    const today = new Date().toISOString().split('T')[0];

    for (const memory of newMemories) {
      if (!memory.id) {
        memory.id = generateId('mem');
      }
      memory.created_at = memory.created_at || new Date().toISOString();

      let evolved = false;

      // Check against valid existing memories of the same type
      for (const ex of existing) {
        if (ex.type !== memory.type) continue;
        if (ex.still_valid === false) continue;

        // Check reinforcement first (higher priority — same content should boost, not contradict)
        if (_isReinforcement(memory, ex)) {
          if (ex.confidence && typeof ex.confidence.score === 'number') {
            ex.confidence.score = Math.min(1.0, ex.confidence.score + 0.05);
          } else {
            ex.confidence = { score: Math.min(1.0, (ex.confidence?.score || 0.5) + 0.05) };
          }
          ex.last_accessed = new Date().toISOString();
          reinforced.push({ existing_id: ex.id, new_content: memory.content });
          evolved = true;
          break;
        }

        // Check contradiction
        if (_isContradiction(memory, ex)) {
          ex.valid_until = today;
          ex.still_valid = false;
          memory.supersedes = ex.id;
          memory.valid_from = memory.valid_from || today;
          memory.still_valid = true;
          existing.push(memory);
          added.push(memory);
          superseded.push({ old_id: ex.id, new_id: memory.id });
          evolved = true;
          break;
        }
      }

      // New memory — no match found
      if (!evolved) {
        // Exact duplicate check (same as addMemories)
        const duplicate = existing.some(m =>
          m.content.toLowerCase() === memory.content.toLowerCase()
        );
        if (!duplicate) {
          memory.valid_from = memory.valid_from || today;
          memory.still_valid = true;
          existing.push(memory);
          added.push(memory);
        }
      }
    }

    // Persist
    if (added.length > 0 || superseded.length > 0 || reinforced.length > 0) {
      await this.saveMemories(existing);
    }

    console.log(
      `[anamnesis] evolution: ${added.length} added, ${superseded.length} superseded, ${reinforced.length} reinforced`
    );

    return { added, superseded, reinforced };
  }

  /**
   * Search memories by type or tags
   * @param {Object} query - Search query
   * @returns {Promise<Object[]>} Matching memories
   */
  async searchMemories(query = {}) {
    const memories = await this.loadMemories();

    return memories.filter(m => {
      if (query.type && m.type !== query.type) return false;
      if (query.tags && !query.tags.some(t => m.tags?.includes(t))) return false;
      if (query.minConfidence && (m.confidence?.score || 0) < query.minConfidence) return false;
      return true;
    });
  }

  // ============================================
  // Identity Management
  // ============================================

  /**
   * Load identity/self-model
   * @returns {Promise<Object>} Identity object
   */
  async loadIdentity() {
    const path = this._path(this.config.identityFile);

    if (!existsSync(path)) {
      return {
        core_values: [],
        growth_narrative: '',
        capabilities: [],
        relationships: {},
        last_updated: null
      };
    }

    const content = await readFile(path, 'utf-8');
    return this._parseIdentityMarkdown(content);
  }

  /**
   * Save identity/self-model
   * @param {Object} identity - Identity object
   */
  async saveIdentity(identity) {
    const path = this._path(this.config.identityFile);
    identity.last_updated = new Date().toISOString();
    const content = this._formatIdentityMarkdown(identity);
    await writeFile(path, content, 'utf-8');
  }

  /**
   * Update identity with new insights
   * @param {Object} updates - Partial identity updates
   */
  async updateIdentity(updates) {
    const identity = await this.loadIdentity();

    // Merge arrays
    if (updates.core_values) {
      identity.core_values = [...new Set([...identity.core_values, ...updates.core_values])];
    }
    if (updates.capabilities) {
      identity.capabilities = [...new Set([...identity.capabilities, ...updates.capabilities])];
    }

    // Update growth narrative
    if (updates.growth_narrative) {
      identity.growth_narrative = updates.growth_narrative;
    }

    // Merge relationships
    if (updates.relationships) {
      identity.relationships = { ...identity.relationships, ...updates.relationships };
    }

    await this.saveIdentity(identity);
    return identity;
  }

  // ============================================
  // Reflection Logs
  // ============================================

  /**
   * Save a reflection log
   * @param {Object} reflection - Reflection data
   * @returns {Promise<string>} Path to saved file
   */
  async saveReflection(reflection) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}.json`;
    const path = join(this.config.basePath, this.config.reflectionsDir, filename);

    await writeFile(path, JSON.stringify(reflection, null, 2), 'utf-8');
    return path;
  }

  /**
   * Load reflection logs
   * @param {number} limit - Maximum logs to return
   * @returns {Promise<Object[]>} Reflection logs
   */
  async loadReflections(limit = 10) {
    const dir = join(this.config.basePath, this.config.reflectionsDir);

    if (!existsSync(dir)) {
      return [];
    }

    const files = await readdir(dir);
    const jsonFiles = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);

    const reflections = [];
    for (const file of jsonFiles) {
      const content = await readFile(join(dir, file), 'utf-8');
      reflections.push(JSON.parse(content));
    }

    return reflections;
  }

  // ============================================
  // Markdown Parsing/Formatting
  // ============================================

  /**
   * Parse questions from markdown
   * @private
   */
  _parseQuestionsMarkdown(content) {
    const questions = [];
    const lines = content.split('\n');
    let current = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Pending question
      if (trimmed.startsWith('- [ ]')) {
        if (current) questions.push(current);
        current = {
          id: generateId('q'),
          question: trimmed.slice(6).trim(),
          status: 'pending'
        };
      }
      // Resolved question
      else if (trimmed.startsWith('- [x]')) {
        if (current) questions.push(current);
        current = {
          id: generateId('q'),
          question: trimmed.slice(6).trim(),
          status: 'answered'
        };
      }
      // Context line (indented)
      else if (current && trimmed.startsWith('_') && trimmed.endsWith('_')) {
        current.context = trimmed.slice(1, -1);
      }
      // Metadata comment
      else if (current && trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
        try {
          const meta = JSON.parse(trimmed.slice(4, -3));
          Object.assign(current, meta);
        } catch (e) {
          // Ignore invalid metadata
        }
      }
    }

    if (current) questions.push(current);
    return questions;
  }

  /**
   * Format questions as markdown
   * @private
   */
  _formatQuestionsMarkdown(questions) {
    const lines = [
      '# Pending Questions',
      '',
      `_Generated from reflection. Last updated: ${new Date().toISOString()}_`,
      ''
    ];

    // Pending questions first
    const pending = questions.filter(q => q.status === 'pending');
    const resolved = questions.filter(q => q.status !== 'pending');

    for (const q of pending) {
      lines.push(`- [ ] ${q.question}`);
      if (q.context) {
        lines.push(`  _${q.context}_`);
      }
      // Store metadata in HTML comment
      const meta = {
        id: q.id,
        curiosity_type: q.curiosity_type,
        curiosity_score: q.curiosity_score,
        timing: q.timing,
        sensitivity: q.sensitivity,
        source_memory_ids: q.source_memory_ids
      };
      lines.push(`  <!-- ${JSON.stringify(meta)} -->`);
      lines.push('');
    }

    // Resolved questions (recent only)
    if (resolved.length > 0) {
      lines.push('## Resolved');
      lines.push('');
      for (const q of resolved.slice(0, 10)) {
        lines.push(`- [x] ${q.question}`);
        if (q.answer_summary) {
          lines.push(`  _Answer: ${q.answer_summary}_`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format predictions as markdown
   * @private
   */
  _formatPredictionsMarkdown(predictions) {
    const lines = ['# Predictions', '', `_Last updated: ${new Date().toISOString()}_`, ''];
    const pending = predictions.filter(p => p.status === 'pending');
    const resolved = predictions.filter(p => p.status !== 'pending');

    if (pending.length > 0) {
      lines.push('## Pending');
      lines.push('');
      for (const p of pending) {
        lines.push(`- [ ] ${p.content}`);
        const meta = { id: p.id, planted: p.planted, confidence: p.confidence, status: p.status, source_memory_ids: p.source_memory_ids };
        lines.push(`  <!-- ${JSON.stringify(meta)} -->`);
        lines.push('');
      }
    }

    if (resolved.length > 0) {
      lines.push('## Resolved');
      lines.push('');
      for (const p of resolved.slice(0, 20)) {
        lines.push(`- [x] ${p.content} [${p.status}]`);
        const meta = { id: p.id, planted: p.planted, resolved: p.resolved_at, status: p.status };
        lines.push(`  <!-- ${JSON.stringify(meta)} -->`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Parse predictions from markdown
   * @private
   */
  _parsePredictionsMarkdown(content) {
    const predictions = [];
    const lines = content.split('\n');
    let current = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        if (current) predictions.push(current);
        const isPending = trimmed.startsWith('- [ ]');
        current = {
          id: generateId('pred'),
          content: trimmed.slice(6).replace(/\s*\[.*\]\s*$/, '').trim(),
          status: isPending ? 'pending' : 'resolved'
        };
      } else if (current && trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
        try {
          const meta = JSON.parse(trimmed.slice(4, -3));
          Object.assign(current, meta);
        } catch (e) {
          // Ignore invalid metadata
        }
      }
    }
    if (current) predictions.push(current);
    return predictions;
  }

  /**
   * Parse memories from markdown
   * @private
   */
  _parseMemoriesMarkdown(content) {
    const memories = [];
    const sections = content.split(/^## /m).slice(1);

    for (const section of sections) {
      const lines = section.split('\n');
      const type = lines[0].trim().toLowerCase();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('- ')) {
          const memory = {
            id: generateId('mem'),
            type,
            content: line.slice(2).trim()
          };

          // Check for metadata on next line
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('<!--')) {
            try {
              const metaLine = lines[i + 1].trim();
              const meta = JSON.parse(metaLine.slice(4, -3));
              Object.assign(memory, meta);
              i++;
            } catch (e) {
              // Ignore invalid metadata
            }
          }

          memories.push(memory);
        }
      }
    }

    return memories;
  }

  /**
   * Format memories as markdown
   * @private
   */
  _formatMemoriesMarkdown(memories) {
    const lines = [
      '# Memory',
      '',
      `_Last updated: ${new Date().toISOString()}_`,
      ''
    ];

    // Group by type
    const byType = {};
    for (const m of memories) {
      if (!byType[m.type]) byType[m.type] = [];
      byType[m.type].push(m);
    }

    // Type order
    const typeOrder = ['fact', 'preference', 'relationship', 'principle', 'commitment', 'moment', 'skill'];

    for (const type of typeOrder) {
      if (byType[type]?.length > 0) {
        lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}`);
        lines.push('');

        for (const m of byType[type]) {
          lines.push(`- ${m.content}`);

          // Store metadata in HTML comment
          const meta = {
            id: m.id,
            confidence: m.confidence,
            tags: m.tags,
            source_quote: m.source_quote,
            source_turn: m.source_turn,
            created_at: m.created_at,
            valid_from: m.valid_from,
            valid_until: m.valid_until,
            still_valid: m.still_valid,
            supersedes: m.supersedes,
            salience: m.salience,
            confabulation_risk: m.confabulation_risk,
            confabulation_reason: m.confabulation_reason
          };
          lines.push(`  <!-- ${JSON.stringify(meta)} -->`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Parse identity from markdown
   * @private
   */
  _parseIdentityMarkdown(content) {
    const identity = {
      core_values: [],
      growth_narrative: '',
      capabilities: [],
      relationships: {},
      last_updated: null
    };

    const sections = content.split(/^## /m);

    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0].trim().toLowerCase();

      if (title.includes('core values')) {
        identity.core_values = lines
          .slice(1)
          .filter(l => l.trim().startsWith('- '))
          .map(l => l.trim().slice(2));
      }
      else if (title.includes('growth')) {
        identity.growth_narrative = lines
          .slice(1)
          .filter(l => l.trim() && !l.trim().startsWith('-'))
          .join('\n')
          .trim();
      }
      else if (title.includes('capabilities')) {
        identity.capabilities = lines
          .slice(1)
          .filter(l => l.trim().startsWith('- '))
          .map(l => l.trim().slice(2));
      }
    }

    return identity;
  }

  /**
   * Format identity as markdown
   * @private
   */
  _formatIdentityMarkdown(identity) {
    const lines = [
      '# Identity',
      '',
      `_Last updated: ${identity.last_updated || new Date().toISOString()}_`,
      '',
      '## Core Values',
      ''
    ];

    for (const value of identity.core_values || []) {
      lines.push(`- ${value}`);
    }
    lines.push('');

    lines.push('## Growth Narrative');
    lines.push('');
    lines.push(identity.growth_narrative || '_No narrative yet._');
    lines.push('');

    lines.push('## Capabilities');
    lines.push('');
    for (const cap of identity.capabilities || []) {
      lines.push(`- ${cap}`);
    }
    lines.push('');

    if (Object.keys(identity.relationships || {}).length > 0) {
      lines.push('## Key Relationships');
      lines.push('');
      for (const [name, desc] of Object.entries(identity.relationships)) {
        lines.push(`### ${name}`);
        lines.push(desc);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Get store statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    const memories = await this.loadMemories();
    const questions = await this.loadQuestions();
    const identity = await this.loadIdentity();
    const reflections = await this.loadReflections(100);

    const memoryByType = {};
    for (const m of memories) {
      memoryByType[m.type] = (memoryByType[m.type] || 0) + 1;
    }

    return {
      memories: {
        total: memories.length,
        by_type: memoryByType
      },
      questions: {
        total: questions.length,
        pending: questions.filter(q => q.status === 'pending').length,
        answered: questions.filter(q => q.status === 'answered').length
      },
      identity: {
        core_values: identity.core_values?.length || 0,
        capabilities: identity.capabilities?.length || 0,
        relationships: Object.keys(identity.relationships || {}).length
      },
      reflections: {
        total: reflections.length
      }
    };
  }
}

// ============================================
// Evolution Helpers (module-level)
// ============================================

/**
 * Detect contradiction: same type + (tag overlap OR negation pattern) + different content
 * @param {Object} newMem
 * @param {Object} existingMem
 * @returns {boolean}
 */
function _isContradiction(newMem, existingMem) {
  if (newMem.type !== existingMem.type) return false;
  if (existingMem.still_valid === false) return false;

  // Exact same content is not a contradiction
  if (newMem.content.toLowerCase() === existingMem.content.toLowerCase()) return false;

  // Check 1: Tag overlap (2+ shared tags with different content)
  const tagOverlap = (newMem.tags || []).filter(t => (existingMem.tags || []).includes(t));
  if (tagOverlap.length >= 2) return true;

  // Check 2: Word overlap in moderate range + negation pattern
  const overlap = _wordOverlap(newMem.content, existingMem.content);
  if (overlap > 0.3 && _hasNegationDivergence(newMem.content, existingMem.content)) return true;

  return false;
}

/**
 * Detect reinforcement: same type, 70%+ word overlap (significant words only)
 * @param {Object} newMem
 * @param {Object} existingMem
 * @returns {boolean}
 */
function _isReinforcement(newMem, existingMem) {
  if (newMem.type !== existingMem.type) return false;
  return _wordOverlap(newMem.content, existingMem.content) > 0.7;
}

/**
 * Calculate word overlap ratio between two texts (significant words only, >3 chars)
 * @param {string} text1
 * @param {string} text2
 * @returns {number} Overlap ratio (0-1)
 */
function _wordOverlap(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;
  const intersection = [...words1].filter(w => words2.has(w));
  return intersection.length / Math.min(words1.size, words2.size);
}

/**
 * Check if two texts diverge by negation (one negates what the other asserts)
 * @param {string} text1
 * @param {string} text2
 * @returns {boolean}
 */
function _hasNegationDivergence(text1, text2) {
  const negations = ['not', "don't", "doesn't", "isn't", "won't", "never", 'no longer', 'stopped', 'changed from'];
  const t1 = text1.toLowerCase();
  const t2 = text2.toLowerCase();

  for (const neg of negations) {
    if ((t1.includes(neg) && !t2.includes(neg)) ||
        (!t1.includes(neg) && t2.includes(neg))) {
      return true;
    }
  }
  return false;
}

export default MemoryStore;
