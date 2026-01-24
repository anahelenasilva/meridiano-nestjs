#!/usr/bin/env ts-node
/**
 * Ralph - Autonomous Coding Agent
 * 
 * When referenced in Cursor chat (@scripts/ralph/ralph.ts), the AI assistant should:
 * 1. Read this script and execute it to get the current story
 * 2. AUTONOMOUSLY execute the instructions from prompt.md to implement the story
 * 3. Update prd.json to mark the story as complete (set passes: true)
 * 4. Append progress to progress.txt
 * 5. Loop to the next story until all are complete
 * 
 * This script provides the context and instructions - the AI executes them autonomously.
 */
import * as fs from 'fs';
import * as path from 'path';

interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
}

interface PRD {
  project: string;
  branchName: string;
  description: string;
  userStories: UserStory[];
}

const SCRIPT_DIR = __dirname;
const PRD_FILE = path.join(SCRIPT_DIR, 'prd.json');
const PROGRESS_FILE = path.join(SCRIPT_DIR, 'progress.txt');
const ARCHIVE_DIR = path.join(SCRIPT_DIR, 'archive');
const LAST_BRANCH_FILE = path.join(SCRIPT_DIR, '.last-branch');
const PROMPT_FILE = path.join(SCRIPT_DIR, 'prompt.md');

function readPRD(): PRD {
  const content = fs.readFileSync(PRD_FILE, 'utf-8');
  return JSON.parse(content) as PRD;
}

function readPrompt(): string {
  return fs.readFileSync(PROMPT_FILE, 'utf-8');
}

function readProgress(): string {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return '';
  }
  return fs.readFileSync(PROGRESS_FILE, 'utf-8');
}

function writeProgress(content: string): void {
  fs.writeFileSync(PROGRESS_FILE, content, 'utf-8');
}


function initializeProgress(): void {
  if (!fs.existsSync(PROGRESS_FILE)) {
    writeProgress(`# Ralph Progress Log\nStarted: ${new Date().toString()}\n---\n`);
  }
}

function archivePreviousRun(lastBranch: string): void {
  const date = new Date().toISOString().split('T')[0];
  const folderName = lastBranch.replace(/^ralph\//, '');
  const archiveFolder = path.join(ARCHIVE_DIR, `${date}-${folderName}`);

  console.log(`Archiving previous run: ${lastBranch}`);
  fs.mkdirSync(archiveFolder, { recursive: true });

  if (fs.existsSync(PRD_FILE)) {
    fs.copyFileSync(PRD_FILE, path.join(archiveFolder, 'prd.json'));
  }
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.copyFileSync(PROGRESS_FILE, path.join(archiveFolder, 'progress.txt'));
  }

  console.log(`   Archived to: ${archiveFolder}`);

  writeProgress(`# Ralph Progress Log\nStarted: ${new Date().toString()}\n---\n`);
}

function checkAndArchiveIfNeeded(): void {
  if (!fs.existsSync(PRD_FILE) || !fs.existsSync(LAST_BRANCH_FILE)) {
    return;
  }

  const prd = readPRD();
  const currentBranch = prd.branchName || '';
  const lastBranch = fs.readFileSync(LAST_BRANCH_FILE, 'utf-8').trim();

  if (currentBranch && lastBranch && currentBranch !== lastBranch) {
    archivePreviousRun(lastBranch);
  }

  if (currentBranch) {
    fs.writeFileSync(LAST_BRANCH_FILE, currentBranch, 'utf-8');
  }
}

function getNextStory(prd: PRD): UserStory | null {
  const incompleteStories = prd.userStories
    .filter((story) => !story.passes)
    .sort((a, b) => a.priority - b.priority);

  return incompleteStories.length > 0 ? incompleteStories[0] : null;
}

function allStoriesComplete(prd: PRD): boolean {
  return prd.userStories.every((story) => story.passes);
}

function updatePRD(prd: PRD): void {
  fs.writeFileSync(PRD_FILE, JSON.stringify(prd, null, 2) + '\n', 'utf-8');
}

function markStoryComplete(storyId: string): void {
  const prd = readPRD();
  const story = prd.userStories.find((s) => s.id === storyId);
  if (story) {
    story.passes = true;
    updatePRD(prd);
  }
}

function getProgressSummary(): string {
  const prd = readPRD();
  const total = prd.userStories.length;
  const completed = prd.userStories.filter((s) => s.passes).length;
  const nextStory = getNextStory(prd);

  let summary = `\n## Ralph Status\n`;
  summary += `- Completed: ${completed}/${total} stories\n`;
  summary += `- Branch: ${prd.branchName}\n`;

  if (nextStory) {
    summary += `- Next: ${nextStory.id} - ${nextStory.title} (Priority ${nextStory.priority})\n`;
  } else {
    summary += `- Status: All stories complete!\n`;
  }

  return summary;
}

function executeRalphIteration(iteration: number, maxIterations: number): boolean {
  const prd = readPRD();
  const prompt = readPrompt();
  const progress = readProgress();

  if (allStoriesComplete(prd)) {
    console.log('\n✅ All stories are complete!');
    return true;
  }

  const nextStory = getNextStory(prd);
  if (!nextStory) {
    console.log('\n✅ No incomplete stories found.');
    return true;
  }

  console.log('\n' + '='.repeat(64));
  console.log(`  Ralph Iteration ${iteration} of ${maxIterations}`);
  console.log('='.repeat(64) + '\n');

  console.log(`📋 Working on: ${nextStory.id} - ${nextStory.title}`);
  console.log(`   Priority: ${nextStory.priority}\n`);

  console.log(getProgressSummary());

  console.log('\n' + '-'.repeat(64));
  console.log('Ralph Agent Instructions:');
  console.log('-'.repeat(64) + '\n');
  console.log(prompt);
  console.log('\n' + '-'.repeat(64));
  console.log('Context:');
  console.log('-'.repeat(64) + '\n');
  console.log('Current Progress Log:');
  console.log(progress || '(empty)');
  console.log('\nNext Story Details:');
  console.log(JSON.stringify(nextStory, null, 2));
  console.log('\n' + '-'.repeat(64));
  console.log('🤖 AUTONOMOUS EXECUTION MODE');
  console.log('-'.repeat(64));
  console.log('When this script is referenced in Cursor chat, the AI assistant');
  console.log('should AUTONOMOUSLY execute the instructions above to implement');
  console.log('this story, then continue to the next story automatically.');
  console.log('-'.repeat(64) + '\n');

  return false;
}

function main(): void {
  const args = process.argv.slice(2);
  let maxIterations = 10;
  let singleIteration = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-iterations' || args[i] === '-n') {
      maxIterations = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--single' || args[i] === '-s') {
      singleIteration = true;
    } else if (/^\d+$/.test(args[i])) {
      maxIterations = parseInt(args[i], 10);
    }
  }

  checkAndArchiveIfNeeded();
  initializeProgress();

  if (singleIteration) {
    const isComplete = executeRalphIteration(1, 1);
    if (isComplete) {
      console.log('\n✅ Ralph completed all tasks!');
      process.exit(0);
    }
  } else {
    console.log(`🚀 Starting Ralph - Max iterations: ${maxIterations}\n`);
    
    let pausedEarly = false;
    for (let i = 1; i <= maxIterations; i++) {
      const isComplete = executeRalphIteration(i, maxIterations);
      if (isComplete) {
        console.log('\n✅ Ralph completed all tasks!');
        console.log(`   Completed at iteration ${i} of ${maxIterations}`);
        process.exit(0);
      }

      if (i < maxIterations) {
        console.log(`\n⏸️  Iteration ${i} paused. Execute the instructions above, then run:`);
        console.log(`   pnpm ralph:single`);
        console.log(`   or continue in chat by referencing: @scripts/ralph/ralph.ts`);
        pausedEarly = true;
        break;
      }
    }

    if (!pausedEarly && !allStoriesComplete(readPRD())) {
      console.log(`\n⚠️  Ralph reached max iterations (${maxIterations}).`);
      console.log(`   Check ${PROGRESS_FILE} for status.`);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}

export { executeRalphIteration, readPRD, readPrompt, readProgress, getNextStory, allStoriesComplete, markStoryComplete, getProgressSummary };
