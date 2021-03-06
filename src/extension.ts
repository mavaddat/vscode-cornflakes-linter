import * as vscode from 'vscode';

import Flake8LintingProvider from './features/flake8Linter';

export function activate(context: vscode.ExtensionContext) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('test.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from test!');
	});

	context.subscriptions.push(disposable);
	let linter = new Flake8LintingProvider();
	linter.activate(context.subscriptions);
}

// this method is called when your extension is deactivated
export function deactivate() {}