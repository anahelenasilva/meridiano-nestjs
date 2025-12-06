I have this meridiano project that scrapps articles from rss feeds, adds those artciels to a database table, and after that it uses AI to summarize the articles and generate briefings. I've recently added a command that extracts a youtube video transcription and saves the transcription among with some metadata in a json file. I'd like to create a command that:
1- extracts the youtube video transcription using the already created code that's working as expected
2- reads the generated json files to both summarize the transcription text and save the data into the already created database table

Use the existing code to create these new features, e.g. use the already created database table, the already created prompts for the IA, the already created AI functions

Handle errors accordingly, DO NOT stop the process, instead log the errors and move to the next file

DO NOT remove the json transcripts files
