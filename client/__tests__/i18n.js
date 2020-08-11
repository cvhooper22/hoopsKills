import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    debug: false,

    resources: {
      'en': {
        'translation': {
          'global': {
            'd3locale': {
              'dateTime': '%x, %X',
              'date': '%b-%d-%Y',
              'time': '%-I:%M:%S %p',
              'periods': ['AM', 'PM'],
              'days': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
              'shortDays': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
              'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
              'shortMonths': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            },
            'd3format': {
              'decimal': '.',
              'thousands': ',',
              'grouping': [3],
              'currency': ['$', '']      
            }
          },
          'views': {
            'mainview': {
              'title': 'Test - Main view',
              'welcome': 'Test - Welcome to WebClient.React.Boilerplate',
              'totalitems': 'Test - Total {{ count }} item',
              'totalitems_plural': 'Test - Total {{ count }} items',
              'formattedtime': 'Test - Formatted time:',
              'pluralformatted': 'Test - Plural formatted:',
              'formattednumber': 'Test - Formatted number:',
              'truncatednumber': 'Test - Truncated number:'
            },
            'secondaryview': {
              'title': 'Test - Secondary view'
            },
            "featureflagsview": {
              "title": "Feature flags",
              "featureflag": "boilerplate.featureFlag."
            }
          },
          'components': {
            'nav': {
              'mainview': 'Test - Main view',
              'secondaryview': 'Test - Secondary view'
            }
          }          
        }
      }
    },

    interpolation: {
      escapeValue: false, // not needed for react!!
    },
    react: {
      useSuspense: false,
      wait: false,
    }
  });

export default i18n;