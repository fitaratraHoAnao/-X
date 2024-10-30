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

// Fonction pour appeler l'API avec le paramètre `ask`
async function fetchApiResponse(query) {
    try {
        const apiUrl = `https://discussion-continue-gem29.vercel.app/api?ask=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl);
        return response.data.result || "⚠️ Aucun résultat trouvé."; 
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

    // Si le message n'est pas une commande, utilisez l'API pour une réponse automatique
    if (!isCommand) {
        console.log("Pas de commande détectée, appel à l'API pour réponse automatique.");
        const apiResponse = await fetchApiResponse(input);
        await message.reply(apiResponse);
    }
}

export default {
    onCall
};
