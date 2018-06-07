const classDiagram = require('./class-diagram.js');
const usecaseDiagram = require('./usecase-diagram.js');
const activityDiagram = require('./activity-diagram.js');
const stateDiagram = require('./state-diagram.js');
const deploymentDiagram = require('./deployment-diagram.js');
const packageDiagram = require('./package-diagram.js');
const sequenceDiagram = require('./sequence-diagram.js');
const Viz = require("viz.js");
require('./svg-utils.js')();

module.exports = function()
{
    this.processYumlDocument = function(text, isDark) 
    {
        var newlines = [];
        var options = { dir: "TB", generate: false, dark: isDark};

        var lines = text.split(/\r|\n/);

        for (var i=0; i<lines.length; i++)
        {
            var line = lines[i].replace(/^\s+|\s+$/g,'');  // Removes leading and trailing spaces
            if (line.startsWith("//"))
                this.processDirectives(line, options);
            else if (line.length > 0)
                newlines.push(line);
        }

        if (newlines.length == 0)
            return "";

        if (!options.hasOwnProperty("type"))
        {
            options.error = "Error: Missing mandatory 'type' directive";
        }

        if (options.hasOwnProperty("error"))
        {
            return options.error;
        }

        var dot = null;
        var svg = null;

        try {
            switch (options.type)
            {
                case "class":
                    dot = classDiagram(newlines, options);
                    break;
                case "usecase":
                    dot = usecaseDiagram(newlines, options);
                    break;
                case "activity":
                    dot = activityDiagram(newlines, options);
                    break;
                case "state":
                    dot = stateDiagram(newlines, options);
                    break;
                case "deployment":
                    dot = deploymentDiagram(newlines, options);
                    break;
                case "package":
                    dot = packageDiagram(newlines, options);
                    break;
                case "sequence":
                    svg = sequenceDiagram(newlines, options);
                    break;
            }
        }
        catch (e) {
            return "Error parsing the yUML file";
        }

        if (dot === null && svg === null)
            return "Error: unable to parse the yUML file";

        if (dot !== null)
        {
            try {
                svg = Viz(buildDotHeader(isDark) + dot);
                svg = processEmbeddedImages(svg, isDark);
            }
            catch (e) {
                return "Error composing the diagram"
            }
        }

        return svg;
    }

    this.processDirectives = function(line, options)
    {
        const directions = {
            leftToRight: "LR",
            rightToLeft: "RL",
            topDown: "TB"
        };

        var keyvalue = /^\/\/\s+\{\s*([\w]+)\s*:\s*([\w]+)\s*\}$/.exec(line);  // extracts directives as:  // {key:value}
        if (keyvalue != null && keyvalue.length == 3)
        {
            var key = keyvalue[1];
            var value = keyvalue[2];

            switch (key)
            {
                case "type":
                    if (/^(class|usecase|activity|state|deployment|package|sequence)$/.test(value))
                        options.type = value;
                    else {
                        options.error = "Error: invalid value for 'type'. Allowed values are: class, usecase, activity, state, deployment, package.";
                        return;
                    }
                    break;
                case "direction":
                    if (/^(leftToRight|rightToLeft|topDown)$/.test(value))
                        options.dir = directions[value];
                    else {
                        options.error = "Error: invalid value for 'direction'. Allowed values are: leftToRight, rightToLeft, topDown <i>(default)</i>.";
                        return;
                    }
                    break;
                case "generate":
                    if (/^(true|false)$/.test(value))
                        options.generate = (value === "true");
                    else {
                        options.error = "Error: invalid value for 'generate'. Allowed values are: true, false <i>(default)</i>.";
                        return;
                    }
            }
        }
    }
}
