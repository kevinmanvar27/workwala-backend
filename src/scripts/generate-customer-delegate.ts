/**
 * Generate Dynamic Localization Delegate for Customer App
 * 
 * Reads app_localizations.dart and generates DynamicAppLocalizations
 * with all getter overrides AND method overrides
 */

import fs from 'fs';
import path from 'path';

const APP_LOCALIZATIONS_PATH = path.join(
  process.cwd(),
  '../Work-Wala-Customer/lib/l10n/app_localizations.dart'
);

const DYNAMIC_DELEGATE_PATH = path.join(
  process.cwd(),
  '../Work-Wala-Customer/lib/services/dynamic_localization_delegate.dart'
);

const CUSTOMER_EN_ARB_PATH = path.join(
  process.cwd(),
  '../Work-Wala-Customer/lib/l10n/app_en.arb'
);

function main() {
  console.log('🚀 Generating Dynamic Localization Delegate...\n');

  // Read app_localizations.dart
  const appLocContent = fs.readFileSync(APP_LOCALIZATIONS_PATH, 'utf-8');
  
  // Read English ARB for fallback values
  const enArb = JSON.parse(fs.readFileSync(CUSTOMER_EN_ARB_PATH, 'utf-8'));

  // Extract all getters (simple properties)
  const getterRegex = /String get (\w+);/g;
  const getters: string[] = [];
  let match;

  while ((match = getterRegex.exec(appLocContent)) !== null) {
    getters.push(match[1]);
  }

  // Extract all methods (with parameters)
  const methodRegex = /String (\w+)\(([^)]+)\);/g;
  const methods: Array<{name: string, params: string}> = [];
  
  while ((match = methodRegex.exec(appLocContent)) !== null) {
    methods.push({
      name: match[1],
      params: match[2]
    });
  }

  console.log(`✅ Found ${getters.length} getters`);
  console.log(`✅ Found ${methods.length} methods\n`);

  // Generate getter overrides
  let overrideCode = '';
  
  for (const getter of getters) {
    const fallback = enArb[getter] || getter;
    // Escape single quotes in fallback
    const escapedFallback = fallback.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    overrideCode += `  @override\n`;
    overrideCode += `  String get ${getter} => _translations['${getter}'] ?? '${escapedFallback}';\n`;
    overrideCode += `  \n`;
  }

  // Generate method overrides
  for (const method of methods) {
    const fallback = enArb[method.name] || method.name;
    // Extract parameter names
    const paramNames = method.params.split(',').map(p => p.trim().split(' ').pop());
    
    overrideCode += `  @override\n`;
    overrideCode += `  String ${method.name}(${method.params}) {\n`;
    overrideCode += `    String text = _translations['${method.name}'] ?? '${fallback.replace(/'/g, "\\'").replace(/\n/g, '\\n')}';\n`;
    
    // Replace placeholders
    for (const paramName of paramNames) {
      overrideCode += `    text = text.replaceAll('{${paramName}}', ${paramName}.toString());\n`;
    }
    
    overrideCode += `    return text;\n`;
    overrideCode += `  }\n`;
    overrideCode += `  \n`;
  }

  // Build complete file
  const fileContent = `import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'dynamic_translation_service.dart';

/// Dynamic AppLocalizations that loads translations from backend
class DynamicAppLocalizations extends AppLocalizations {
  final Map<String, String> _translations;
  final String _localeCode;

  DynamicAppLocalizations(this._localeCode, this._translations) : super(_localeCode);

${overrideCode}}

/// Custom LocalizationsDelegate that uses dynamic translations from backend
class DynamicAppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const DynamicAppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    // Support all locales - we'll fetch translations dynamically
    return true;
  }

  @override
  Future<AppLocalizations> load(Locale locale) async {
    final languageCode = locale.languageCode;
    
    // Try to get dynamic translations from backend
    final translations = await DynamicTranslationService.getTranslations(languageCode);
    
    if (translations != null && translations.isNotEmpty) {
      // Use dynamic translations
      return DynamicAppLocalizations(languageCode, translations);
    }
    
    // Fallback to static ARB files
    return AppLocalizations.delegate.load(locale);
  }

  @override
  bool shouldReload(DynamicAppLocalizationsDelegate old) => false;
}
`;

  // Write file
  fs.writeFileSync(DYNAMIC_DELEGATE_PATH, fileContent, 'utf-8');
  
  console.log(`✅ Generated dynamic delegate with ${getters.length} getters and ${methods.length} methods`);
  console.log(`📁 Output: ${DYNAMIC_DELEGATE_PATH}\n`);
  console.log('🎉 Done!');
}

main();
