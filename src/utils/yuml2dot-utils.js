const fs = require('fs');

module.exports = function()
{
    var colorTable = null;
    const ESCAPED_CHARS = 
    {
        "\n": "<BR/>",
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
    };

    this.escape_label = function(label)
    {
        var newlabel = "";

        for (var i=0; i<label.length; i++)
            newlabel += replaceChar(label.charAt(i));

        function replaceChar(c)
        {
            c = c.replace('{', '\\{').replace('}', '\\}');
            c = c.replace(';', '\n');
            c = c.replace('<', '\\<').replace('>', '\\>');
            // c = c.replace('\\n\\n', '\\n');
            return c;
        }

        return newlabel;
    }

    this.unescape_label = function(label)
    {
        var newlabel = label.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
        newlabel = newlabel.replace(/\\</g, '<').replace(/\\>/g, '>');

        return newlabel;
    }

    this.splitYumlExpr = function(line, separators, escape = "\\")
    {
        var word = "";
        var lastChar = null;
        var parts = [];

        for (var i=0; i<line.length; i++)
        {
            c = line[i];

            if (c === escape && i + 1 < line.length)
            {
                word += c;
                word += line[++i];
            }
            else if (separators.indexOf(c) >= 0 && lastChar === null)
            {
                if (word.length > 0) {
                    parts.push(word.trim());
                    word = "";
                }

                switch (c)
                {
                    case '[':
                        lastChar = ']'; break;
                    case '(':
                        lastChar = ')'; break;
                    case '<':
                        lastChar = '>'; break;
                    case '|':
                        lastChar = '|'; break;
                    default:
                        lastChar = null; break;
                }
                word = c;
            }
            else if (c === lastChar)
            {
                lastChar =  null;
                parts.push(word.trim() + c);
                word = "";
            }
            else
            {
                word += c;
            }
        }

        if (word.length > 0)
            parts.push(word.trim());

        return parts;
    }

    this.extractBgAndNote = function(part, allowNote)
    {
        var ret = { bg: "", isNote: false, luma: 128 };

        var bgParts = /^(.*)\{ *bg *: *([a-zA-Z]+\d*|#[0-9a-fA-F]{6}) *\}$/.exec(part);
        if (bgParts != null && bgParts.length == 3)
        {
            ret.part = bgParts[1].trim();
            ret.bg = bgParts[2].trim().toLowerCase();

            var luma = getLuma(ret.bg);
            if (luma < 64)
                ret.fontcolor = "white";
            else if (luma > 192)
                ret.fontcolor = "black";
        }
        else
            ret.part = part.trim();

        if (allowNote && part.startsWith("note:"))
        {
            ret.part = ret.part.substring(5).trim();
            ret.isNote = true;
        }
        return ret;
    }

    this.escape_token_escapes = function(spec)
    {
        return spec.replace('\\[', '\\u005b').replace('\\]', '\\u005d');
    }

    this.unescape_token_escapes = function(spec)
    {
        return spec.replace('\\u005b', '[').replace('\\u005d', ']');
    }

    this.recordName = function(label)
    {
        return label.split("|")[0].trim();
    }

    this.formatLabel = function(label, wrap, allowDivisors)
    {
        var lines = [label];

        if (allowDivisors && label.indexOf("|") >= 0)
            lines = label.split('|');

        for (var j=0; j<lines.length; j++)
            lines[j] = wordwrap(lines[j], wrap, "\n");

        label = lines.join('|');

        return escape_label(label);
    }

    this.wordwrap = function(str, width, newline)
    {
        if (!str || str.length<width)
            return str;

        var p;
        for (p = width; p>0 && str[p]!=' '; p--) { }
        if (p > 0) {
            var left = str.substring(0, p);
            var right = str.substring(p+1);
            return left + newline + this.wordwrap(right, width, newline);
        }

        return str;
    }

    this.serializeDot = function(obj)
    {
        if (obj.shape === "record" && !/^<.+>(|<.+>)*$/.test(obj.label)) 
        {
            // Graphviz documentation says (https://www.graphviz.org/doc/info/shapes.html):
            // The record-based shape has largely been superseded and greatly generalized by HTML-like labels.
            // That is, instead of using shape=record, one might consider using shape=none, margin=0 and an HTML-like label. [...]
            // Also note that there are problems using non-trivial edges (edges with ports or labels) between adjacent nodes
            // on the same rank if one or both nodes has a record shape.
        
            if (obj.label.includes("|")) {
                // If label contains a pipe (I.E. multi-row record shapes), we need to use an HTML-like label
                const rows = obj.label.split("|");
          
                const createSingleCellRow = (attr, text, fontSize) => {
                  let htmlTDNode = "<TD " + attr;
                  if (text.startsWith("<")) {
                    const closingTagPosition = text.indexOf(">");
                    htmlTDNode += ` PORT="${text.substr(1, closingTagPosition - 1)}"`;
                    text = text.substr(closingTagPosition + 1);
                  }
                  htmlTDNode += ">";
                  if (fontSize) {
                    htmlTDNode += `<FONT POINT-SIZE="${fontSize}">`;
                  }
                  for (const char of unescape_label(text)) {
                    htmlTDNode += ESCAPED_CHARS[char] || char;
                  }
                  if (fontSize) {
                    htmlTDNode += `</FONT>`;
                  }
                  htmlTDNode += "</TD>";
                  return `<TR>${htmlTDNode}</TR>`;
                };
          
                const title = rows.shift();
                return `[fontsize=${
                  obj.fontsize
                },label=<<TABLE CELLBORDER="1" CELLSPACING="0" CELLPADDING="9" ${
                  obj.fillcolor ? `BGCOLOR="${obj.fillcolor}"` : ""
                } ${obj.fontcolor ? `COLOR="${obj.fontcolor}"` : ""} ${
                  obj.style && obj.style === "rounded" ? 'STYLE="ROUNDED"' : ""
                }>${createSingleCellRow('BORDER="0"', title)}${rows
                  .map(text =>
                    createSingleCellRow('SIDES="T"', text, obj.fontsize * 0.9)
                  )
                  .join("")}</TABLE>>]`;
            }
        
            // On single-row "record", we can use a simpler "rectangle" shape
            obj.shape = "rectangle";
          }

          return (
            "[" +
            Object.keys(obj)
              .map(
                key =>
                  `${key}=` +
                  ("string" === typeof obj[key] ? `"${obj[key]}"` : obj[key])
              )
              .join(" , ") +
            " ]"
          );
    }

    this.serializeDotElements = function(arr)
    {
        var dot = "";

        for (var i=0; i<arr.length; i++)
        {
            var record = arr[i];

            if (record.length == 2)
                dot += '    ' + record[0] + ' ' + serializeDot(record[1]) + "\r\n";
            else if (record.length == 3)
                dot += '    ' + record[0] + " -> " + record[1] + ' ' + serializeDot(record[2]) + "\r\n";
        }

        return dot;
    }

    this.buildDotHeader = function(isDark)
    {
        var colors = isDark ? "color=white, fontcolor=white" : "color=black, fontcolor=black";

        var header = "digraph G {\r\n" 
            + "  graph [ bgcolor=transparent, fontname=Helvetica ]\r\n"
            + "  node [ shape=none, margin=0, " + colors + ", fontname=Helvetica ]\r\n"
            + "  edge [ " + colors + ", fontname=Helvetica ]\r\n";

        return header;
    }

    loadColors = function()
    {
        if (colorTable != null)
            return;
        else
            colorTable = {};

        var rgb = fs.readFileSync(__dirname + "/../../data/rgb.txt", {encoding:"utf8", flag:"r"}).split('\n');
        for (var i=0; i<rgb.length; i++)
        {
            var parts = /^(\d+) (\d+) (\d+) (.*)$/.exec(rgb[i]);

            if (parts != null && parts.length == 5 && parts[4].indexOf(' ') < 0)
            {
                var luma = 0.2126 * parseFloat(parts[0]) + 0.7152 * parseFloat(parts[1]) + 0.0722 * parseFloat(parts[2]);
                colorTable[parts[4].toLowerCase()] = luma;                
            }
        }
    }

    getLuma = function(color)
    {
        loadColors();
        var luma = 128;

        if (color.startsWith('#'))
            luma = 0.2126 * parseInt(color.substr(1,2), 16) + 0.7152 * parseInt(color.substr(3,2), 16) + 0.0722 * parseInt(color.substr(5,2), 16);
        else if (colorTable.hasOwnProperty(color))
            luma = colorTable[color];

        return luma;
    }
}
