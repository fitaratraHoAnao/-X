import fs from 'fs';
import path from 'path';
import axios from 'axios';

const commandRootDir = path.resolve('./plugins/commands');

const fetchCommandFiles = () => {
    const commandFiles = [];

    const categories = fs.readdirSync(commandRootDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const category of categories) {
        const commandDir = path.join(commandRootDir, category);
        const commands = fs.readdirSync(commandDir)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(commandDir, file));

        if (commands.length > 0) {
            commandFiles.push({
                category,
                commands
            });
        }
    }

    return commandFiles;
};

const loadCommand = async (filePath) => {
    try {
        const { default: commandModule } = await import(filePath);
        if (commandModule?.config?.name) {
            return { commandModule, name: commandModule.config.name };
        } else {
            console.warn(`Command config.name not found in ${filePath}`);
            return null;
        }
    } catch (error) {
        console.error(`Failed to load command from ${filePath}:`, error);
        return null;
    }
};

// Fonction pour appeler l'API avec l'URL et le paramètre `ask`
async function fetchApiResponse(query) {
    try {
        // Construction de l'URL avec le paramètre `ask`
        const apiUrl = `https://discussion-continue-gem29.vercel.app/api?ask=${encodeURIComponent(query)}`;
        
        const response = await axios.get(apiUrl);
        return response.data.result || "⚠️ Aucun résultat trouvé.";  // Utilisation d'un champ "result" pour récupérer la réponse
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API :", error.message);
        return "⚠️ Une erreur est survenue lors de la récupération des données.";
    }
}

async function onCall({ message }) {
    const input = message.body.trim();

    const commandFiles = fetchCommandFiles();
    let isCommand = false;

    for (const { commands } of commandFiles) {
        for (const filePath of commands) {
            const commandData = await loadCommand(filePath);
            if (commandData && input.startsWith(commandData.name)) {
                isCommand = true;
                const { commandModule, name } = commandData;

                if (commandModule?.onCall) {
                    const args = input.slice(name.length).trim().split(" ");
                    await commandModule.onCall({ 
                        message, 
                        args 
                    });
                }
                return;
            }
        }
    }

    // Si ce n'est pas une commande, envoyez la réponse automatique via l'API
    if (!isCommand) {
        const apiResponse = await fetchApiResponse(input); // Appel API avec `input` comme `ask`
        await message.reply(apiResponse);
    }

    console.warn('No matching command found.');
}

export default {
    onCall
};
