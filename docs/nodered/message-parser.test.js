/**
 * Node-RED Message Parsing Tests
 * 
 * Tests for the Telegram message parsing function in the Node-RED flow.
 * This tests the "Parse Message (Option B)" function node.
 * 
 * Run with: node docs/nodered/message-parser.test.js
 */

const VALID_FEEDS = ['default', 'technology', 'politics', 'business', 'health', 'science', 'brasil', 'teclas'];

// Extract the parsing logic from the Node-RED flow
function parseMessage(messageText, chatId = '123456789', messageId = '456', username = 'testuser') {
  // Store chat info for later
  const msg = {
    chatId: chatId,
    messageId: messageId,
    username: username
  };

  // If it's a command, ignore it
  if (messageText && messageText.startsWith('/')) {
    msg.payload = {
      isCommand: true,
      command: messageText.split(' ')[0]
    };
    return { msg, isValid: false, isCommand: true };
  }

  const lines = (messageText || '').split('\n');

  // Initialize variables
  let url = null;
  let feedProfile = null;
  let note = null;
  const errors = [];

  // Parse each line for key-value pairs
  lines.forEach(line => {
    const trimmedLine = line.trim();

    // Match URL: label (case-insensitive)
    const urlMatch = trimmedLine.match(/^URL:\s*(.+)$/i);
    if (urlMatch) {
      url = urlMatch[1].trim();
    }

    // Match Feed: label (case-insensitive)
    const feedMatch = trimmedLine.match(/^Feed:\s*(.+)$/i);
    if (feedMatch) {
      feedProfile = feedMatch[1].trim().toLowerCase();
    }

    // Match Note: label (optional, case-insensitive)
    const noteMatch = trimmedLine.match(/^Note:\s*(.+)$/i);
    if (noteMatch) {
      note = noteMatch[1].trim();
    }
  });

  // Validation
  if (!url) {
    errors.push("❌ URL is required. Please include a URL: line.");
  }

  if (!feedProfile) {
    errors.push("❌ Feed profile is required. Please include a Feed: line.");
  }

  // URL format validation
  if (url && !url.match(/^https?:\/\/.+/i)) {
    errors.push("❌ The URL doesn't appear to be valid. Please check and try again.");
  }

  // Feed profile validation
  if (feedProfile && !VALID_FEEDS.includes(feedProfile)) {
    errors.push(`❌ Feed '${feedProfile}' doesn't exist. Available feeds: ${VALID_FEEDS.join(', ')}`);
  }

  // Set payload for next node
  if (errors.length > 0) {
    msg.payload = {
      url: url,
      feedProfile: feedProfile,
      note: note,
      errors: errors,
      isValid: false
    };
    return { msg, isValid: false, errors };
  }

  msg.payload = {
    url: url,
    feedProfile: feedProfile,
    note: note,
    errors: null,
    isValid: true,
    metadata: {
      chatId: chatId.toString(),
      messageId: messageId.toString(),
      username: username || undefined
    }
  };

  return { msg, isValid: true };
}

// Test utilities
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n       Expected: ${expected}\n       Actual: ${actual}`);
  }
}

function assertTrue(actual, message = '') {
  if (actual !== true) {
    throw new Error(`${message}\n       Expected: true\n       Actual: ${actual}`);
  }
}

function assertFalse(actual, message = '') {
  if (actual !== false) {
    throw new Error(`${message}\n       Expected: false\n       Actual: ${actual}`);
  }
}

function assertContains(array, item, message = '') {
  if (!array.includes(item)) {
    throw new Error(`${message}\n       Expected array to contain: ${item}\n       Array: ${array.join(', ')}`);
  }
}

console.log('\n========================================');
console.log('Node-RED Message Parser Tests');
console.log('========================================\n');

// ==========================================
// VALID MESSAGE FORMATS
// ==========================================
console.log('📝 Valid Message Formats:');

test('Valid Format 1 - Basic URL and Feed', () => {
  const result = parseMessage(
    'URL: https://addyosmani.com/blog/self-improving-agents/\nFeed: technology'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://addyosmani.com/blog/self-improving-agents/');
  assertEqual(result.msg.payload.feedProfile, 'technology');
  assertEqual(result.msg.payload.note, null);
});

test('Valid Format 2 - With extra whitespace', () => {
  const result = parseMessage(
    'URL:   https://example.com/article\nFeed:   technology'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com/article');
  assertEqual(result.msg.payload.feedProfile, 'technology');
});

test('Valid Format 3 - Reverse order (Feed before URL)', () => {
  const result = parseMessage(
    'Feed: technology\nURL: https://example.com/design-article'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com/design-article');
  assertEqual(result.msg.payload.feedProfile, 'technology');
});

test('Valid Format 4 - With optional description (Note field)', () => {
  const result = parseMessage(
    'URL: https://example.com/article\nFeed: technology\nNote: Great article about AI agents'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com/article');
  assertEqual(result.msg.payload.feedProfile, 'technology');
  assertEqual(result.msg.payload.note, 'Great article about AI agents');
});

test('Valid Format 5 - Mixed case labels (url:, feed:)', () => {
  const result = parseMessage(
    'url: https://example.com/article\nfeed: technology'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com/article');
  assertEqual(result.msg.payload.feedProfile, 'technology');
});

test('Valid Format 6 - Mixed case labels (Url:, Feed:)', () => {
  const result = parseMessage(
    'Url: https://example.com/article\nFeed: business'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.feedProfile, 'business');
});

test('Valid Format 7 - Feed with uppercase stored as lowercase', () => {
  const result = parseMessage(
    'URL: https://example.com/article\nFeed: TECHNOLOGY'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.feedProfile, 'technology'); // Should be lowercase
});

test('Valid Format 8 - Feed with mixed case', () => {
  const result = parseMessage(
    'URL: https://example.com/article\nFeed: TeChNoLoGy'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.feedProfile, 'technology'); // Should be normalized to lowercase
});

test('Valid Format 9 - All valid feeds', () => {
  VALID_FEEDS.forEach(feed => {
    const result = parseMessage(`URL: https://example.com/article\nFeed: ${feed}`);
    assertTrue(result.isValid, `Feed "${feed}" should be valid`);
  });
});

test('Valid Format 10 - URL with query parameters', () => {
  const result = parseMessage(
    'URL: https://example.com/article?ref=twitter&utm_source=social\nFeed: technology'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com/article?ref=twitter&utm_source=social');
});

test('Valid Format 11 - URL with port number', () => {
  const result = parseMessage(
    'URL: https://example.com:8080/article\nFeed: technology'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com:8080/article');
});

test('Valid Format 12 - URL with path and hash', () => {
  const result = parseMessage(
    'URL: https://example.com/path/to/article#section\nFeed: technology'
  );
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com/path/to/article#section');
});

// ==========================================
// INVALID MESSAGE FORMATS
// ==========================================
console.log('\n📝 Invalid Message Formats:');

test('Invalid Format 1 - Missing URL', () => {
  const result = parseMessage('Feed: technology');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ URL is required. Please include a URL: line.");
});

test('Invalid Format 2 - Missing Feed', () => {
  const result = parseMessage('URL: https://example.com/article');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ Feed profile is required. Please include a Feed: line.");
});

test('Invalid Format 3 - Missing both URL and Feed', () => {
  const result = parseMessage('Note: Some note');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ URL is required. Please include a URL: line.");
  assertContains(result.errors, "❌ Feed profile is required. Please include a Feed: line.");
});

test('Invalid Format 4 - Invalid URL (not a valid URL)', () => {
  const result = parseMessage('URL: not-a-valid-url\nFeed: technology');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ The URL doesn't appear to be valid. Please check and try again.");
});

test('Invalid Format 5 - Invalid URL (just domain)', () => {
  const result = parseMessage('URL: example.com\nFeed: technology');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ The URL doesn't appear to be valid. Please check and try again.");
});

test('Invalid Format 6 - Invalid URL (http without slashes)', () => {
  const result = parseMessage('URL: http:example.com\nFeed: technology');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ The URL doesn't appear to be valid. Please check and try again.");
});

test('Invalid Format 7 - Non-existent feed', () => {
  const result = parseMessage('URL: https://example.com/article\nFeed: nonexistent-feed');
  assertFalse(result.isValid);
  // Check that the error message contains the feed name and valid feeds list
  const errorMessage = result.errors.find(e => e.includes('nonexistent-feed'));
  assertTrue(errorMessage !== undefined, 'Should have error about invalid feed');
  assertTrue(errorMessage.includes('default, technology, politics, business, health, science, brasil, teclas'), 'Should list valid feeds');
});

test('Invalid Format 8 - Empty message', () => {
  const result = parseMessage('');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ URL is required. Please include a URL: line.");
  assertContains(result.errors, "❌ Feed profile is required. Please include a Feed: line.");
});

test('Invalid Format 9 - Whitespace only message', () => {
  const result = parseMessage('   \n\n   ');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ URL is required. Please include a URL: line.");
  assertContains(result.errors, "❌ Feed profile is required. Please include a Feed: line.");
});

test('Invalid Format 10 - Invalid URL + missing Feed', () => {
  const result = parseMessage('URL: invalid-url');
  assertFalse(result.isValid);
  assertContains(result.errors, "❌ Feed profile is required. Please include a Feed: line.");
});

test('Invalid Format 11 - Invalid URL + invalid Feed', () => {
  const result = parseMessage('URL: not-a-url\nFeed: invalid');
  assertFalse(result.isValid);
  // Should have both URL and feed errors
  const hasUrlError = result.errors.some(e => e.includes("URL doesn't appear to be valid"));
  const hasFeedError = result.errors.some(e => e.includes("Feed 'invalid' doesn't exist"));
  assertTrue(hasUrlError, 'Should have URL validation error');
  assertTrue(hasFeedError, 'Should have feed validation error');
});

// ==========================================
// PARSING RULES
// ==========================================
console.log('\n📝 Parsing Rules:');

test('Rule 1 - Case Insensitivity (URL: lowercase)', () => {
  const result = parseMessage('url: https://example.com\nfeed: technology');
  assertTrue(result.isValid);
});

test('Rule 2 - Case Insensitivity (URL: uppercase)', () => {
  const result = parseMessage('URL: https://example.com\nFEED: technology');
  assertTrue(result.isValid);
});

test('Rule 3 - Case Insensitivity (mixed)', () => {
  const result = parseMessage('Url: https://example.com\nFeed: technology');
  assertTrue(result.isValid);
});

test('Rule 4 - Whitespace Tolerance (spaces after colon)', () => {
  const result = parseMessage('URL:   https://example.com\nFeed:   technology');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com');
});

test('Rule 5 - Whitespace Tolerance (tabs after colon)', () => {
  const result = parseMessage('URL:\thttps://example.com\nFeed:\ttechnology');
  assertTrue(result.isValid);
});

test('Rule 6 - Whitespace Tolerance (trailing whitespace)', () => {
  const result = parseMessage('URL: https://example.com   \nFeed: technology   ');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com');
});

test('Rule 7 - Line Order (URL first)', () => {
  const result = parseMessage('URL: https://example.com\nFeed: technology');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com');
});

test('Rule 8 - Line Order (Feed first)', () => {
  const result = parseMessage('Feed: technology\nURL: https://example.com');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.url, 'https://example.com');
});

test('Rule 9 - Line Order (Note first)', () => {
  const result = parseMessage('Note: My note\nURL: https://example.com\nFeed: technology');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.note, 'My note');
});

test('Rule 10 - Optional Note field (not present)', () => {
  const result = parseMessage('URL: https://example.com\nFeed: technology');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.note, null);
});

test('Rule 11 - Optional Note field (present)', () => {
  const result = parseMessage('URL: https://example.com\nFeed: technology\nNote: This is a note');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.note, 'This is a note');
});

test('Rule 12 - HTTP URL (valid)', () => {
  const result = parseMessage('URL: http://example.com/article\nFeed: technology');
  assertTrue(result.isValid);
});

test('Rule 13 - HTTPS URL (valid)', () => {
  const result = parseMessage('URL: https://example.com/article\nFeed: technology');
  assertTrue(result.isValid);
});

test('Rule 14 - Feed validation (all valid feeds)', () => {
  const allFeeds = ['default', 'technology', 'politics', 'business', 'health', 'science', 'brasil', 'teclas'];
  allFeeds.forEach(feed => {
    const result = parseMessage(`URL: https://example.com\nFeed: ${feed}`);
    assertTrue(result.isValid, `Feed "${feed}" should be valid`);
  });
});

// ==========================================
// METADATA TESTS
// ==========================================
console.log('\n📝 Metadata Tests:');

test('Metadata - Includes chatId', () => {
  const result = parseMessage('URL: https://example.com\nFeed: technology', '123456');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.metadata.chatId, '123456');
});

test('Metadata - Includes messageId', () => {
  const result = parseMessage('URL: https://example.com\nFeed: technology', '123456', '789');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.metadata.messageId, '789');
});

test('Metadata - Includes username when provided', () => {
  const result = parseMessage('URL: https://example.com\nFeed: technology', '123456', '789', 'testuser');
  assertTrue(result.isValid);
  assertEqual(result.msg.payload.metadata.username, 'testuser');
});

// ==========================================
// COMMAND HANDLING
// ==========================================
console.log('\n📝 Command Handling:');

test('Command - /start is detected', () => {
  const result = parseMessage('/start', '123456');
  assertTrue(result.isCommand);
  assertEqual(result.msg.payload.command, '/start');
});

test('Command - /help is detected', () => {
  const result = parseMessage('/help', '123456');
  assertTrue(result.isCommand);
  assertEqual(result.msg.payload.command, '/help');
});

test('Command - /submit is detected', () => {
  const result = parseMessage('/submit https://example.com technology', '123456');
  assertTrue(result.isCommand);
  assertEqual(result.msg.payload.command, '/submit');
});

// ==========================================
// SUMMARY
// ==========================================
console.log('\n========================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}

console.log('All tests passed! ✅\n');
