# Parse Markdown Article Function Regex

The regex pattern to parse an article markdown is:

```
/^#[ \t]+([^\r\n]*)/m
```

Breaking down this regex parttern:

- `^#` - matches # at the start of a line
- `[ \t]+` - matches one or more spaces/tabs (required whitespace after # in markdown)
- `([^\r\n]*)` - captures zero or more non-newline characters (everything else on the line)
- `m` flag - enables multiline mode
