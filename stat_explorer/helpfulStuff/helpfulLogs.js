//putting this in the lineupUtils (line 186-ish) right after a new lineup is
// created is pretty helpful for tracking down player specific stuff
if (subData.subs.in.includes('SAUNDERS,RICHIE')) {
    console.log('\t***Richie coming in');
    console.log('\tsubData is: ', subData);
    console.log('\tnew lineup is: ', newLineup);
    console.log(`\tScore is visitor: ${lineupData.gameScore.vscore} home: ${lineupData.gameScore.hscore}`);
  }
  if (subData.subs.out.includes('SAUNDERS,RICHIE')) {
    console.log('\t***Richie going out');
    console.log('\tsubData is: ', subData);
    console.log('\tnew lineup is: ', newLineup);
    console.log(`\tScore is visitor: ${lineupData.gameScore.vscore} home: ${lineupData.gameScore.hscore}`);
  }