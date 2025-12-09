import json
from collections import defaultdict

data = json.load(open('data.json', encoding='utf-8'))

# Group by year-month
coverage = defaultdict(int)

for record in data:
    date_str = record.get('date', '')
    if not date_str:
        continue
    
    # Extract year-month
    if '2024' in date_str:
        year = '2024'
        if '01.' in date_str or 'Ocak' in date_str or '1.' in date_str:
            month = '01'
        elif '02.' in date_str or 'Şubat' in date_str or '2.' in date_str:
            month = '02'
        elif '03.' in date_str or 'Mart' in date_str or '3.' in date_str:
            month = '03'
        elif '04.' in date_str or 'Nisan' in date_str or '4.' in date_str:
            month = '04'
        elif '05.' in date_str or 'Mayıs' in date_str or '5.' in date_str:
            month = '05'
        elif '06.' in date_str or 'Haziran' in date_str or '6.' in date_str:
            month = '06'
        elif '07.' in date_str or 'Temmuz' in date_str or '7.' in date_str:
            month = '07'
        elif '08.' in date_str or 'Ağustos' in date_str or '8.' in date_str:
            month = '08'
        elif '09.' in date_str or 'Eylül' in date_str or '9.' in date_str:
            month = '09'
        elif '10.' in date_str or 'Ekim' in date_str:
            month = '10'
        elif '11.' in date_str or 'Kasım' in date_str:
            month = '11'
        elif '12.' in date_str or 'Aralık' in date_str:
            month = '12'
        else:
            month = '??'
        coverage[f"{year}-{month}"] += 1
    elif '2025' in date_str:
        year = '2025'
        if '01.' in date_str or 'Ocak' in date_str or '1.' in date_str:
            month = '01'
        elif '02.' in date_str or 'Şubat' in date_str or '2.' in date_str:
            month = '02'
        elif '03.' in date_str or 'Mart' in date_str or '3.' in date_str:
            month = '03'
        elif '04.' in date_str or 'Nisan' in date_str or '4.' in date_str:
            month = '04'
        elif '05.' in date_str or 'Mayıs' in date_str or '5.' in date_str:
            month = '05'
        elif '06.' in date_str or 'Haziran' in date_str or '6.' in date_str:
            month = '06'
        elif '07.' in date_str or 'Temmuz' in date_str or '7.' in date_str:
            month = '07'
        elif '08.' in date_str or 'Ağustos' in date_str or '8.' in date_str:
            month = '08'
        elif '09.' in date_str or 'Eylül' in date_str or '9.' in date_str:
            month = '09'
        elif '10.' in date_str or 'Ekim' in date_str:
            month = '10'
        elif '11.' in date_str or 'Kasım' in date_str:
            month = '11'
        elif '12.' in date_str or 'Aralık' in date_str:
            month = '12'
        else:
            month = '??'
        coverage[f"{year}-{month}"] += 1

print(f"Total records: {len(data)}")
print("\nCoverage by Year-Month:")
for key in sorted(coverage.keys()):
    print(f"  {key}: {coverage[key]} records")

