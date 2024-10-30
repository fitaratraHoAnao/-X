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

// Fonction pour appeler l'API Gemini sans envoyer `message`
async function fetchApiResponse(prompt) {
    try {
        const response = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
            prompt,
            customId: 'yourCustomId'
        });
        return response.data;  // Retourne la réponse de l'API
    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Gemini :", error.message);
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
                isCommand = true; // Message est une commande
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

    // Si ce n'est pas une commande, envoyez la réponse automatique via l'API Gemini
    if (!isCommand) {
        const apiResponse = await fetchApiResponse(input); // Appel API avec prompt uniquement
        await message.reply(apiResponse);
    }

    console.warn('No matching command found.');
}

export default {
    onCall
};
