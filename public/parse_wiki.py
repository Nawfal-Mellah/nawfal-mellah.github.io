import requests
from bs4 import BeautifulSoup

import re

import pandas as pd

from datetime import datetime


url = "https://fr.wikipedia.org/wiki/Liste_des_matchs_de_l%27%C3%A9quipe_de_France_de_football_par_adversaire"

response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

# Utilisez soup.find() et d'autres méthodes pour extraire les données nécessaires

dataset = []

tables = soup.find_all("table")

pattern_scoreinit = re.compile(r'(\d+-\d+)\s*ap\s*\((.*?)\)')
pattern_scorefinal = re.compile(r'ap\s*\((.*?)\)')

pattern_score = re.compile(r'(\d+)\s*-\s*(\d+)')

pattern_location = r'(?P<city>.+)\s+\((?P<stadium>.*?)\)\s*(?P<country>.+)'

pattern_reference = re.compile(r'\[n \d+\]') # Pattern to match [n number]

current_date = datetime.strptime("2024-01-23", "%Y-%m-%d")

for t in tables:
    caption = t.find("caption")
    if caption and caption.text.strip() == "Liste des confrontations":

        matches = t.select('tbody tr')[1:]
        for match in matches:
            date = pays = ville = stade = equipe1 = equipe2 = score1 = score2 = result_france = competition = None
            try:
                match_data = match.find_all("td")
                # match_number = match_data[0].text.strip()
                
                date = match_data[1].find("time")
                if not date:
                    continue
                date = datetime.strptime(date["datetime"], "%Y-%m-%d")
                if date >= current_date :
                    continue

                equipe_adverse = match_data[3].text.split('[')[0].replace("France", "").replace(" - ", "").strip() 
                if match_data[3].text[:6] == "France":
                    equipe1 = "France"
                    equipe2 = equipe_adverse
                else: 
                    equipe1 = equipe_adverse
                    equipe2 = "France"
                # print(match_data[3].text, '\t', equipe1, '\t', equipe2)
                # match_details = match_data[3].text.strip().split('-', 1)
                # equipe1 = match_details[0].strip()
                # equipe2 = match_details[1].strip()

                match_details = match_data[4].text.strip().split('[')[0]

                def get_result(score_france, score_adversaire):
                    if score_france > score_adversaire:
                        return "win"
                    elif score_france == score_adversaire:
                        return "draw"
                    else:
                        return "loss"
                score_final = None
                    
                if 'ap' in match_details:
                    # print(match_details)
                    score_final = pattern_scorefinal.findall(match_details)
                    
                    if score_final:
                        # score_final = score_final[0].split(' ')[0].split('-')
                        score_final1, score_final2 = pattern_score.findall(score_final[0])[0]
                        score_final1= int(score_final1)
                        score_final2 = int(score_final2)
                        
                        if equipe1 == "France":
                            result_france = get_result(score_final1, score_final2)
                        else: 
                            result_france = get_result(score_final2, score_final1)

                        score = pattern_scoreinit.findall(match_details)[0][0] #.split('-')
                    else:
                        score = match_details.replace('ap', '').strip() 
                    
                    score1, score2 = pattern_score.findall(score)[0]
                    score1 = int(score1)
                    score2 = int(score2)

                if not score_final:
                    result_france = get_result(score_final2, score_final1)


                if 'ap' not in match_details:

                    score =  match_details
                    score1, score2 = pattern_score.findall(score)[0]
                    score1 = int(score1)
                    score2 = int(score2)
                    if equipe1 == "France":
                        result_france = get_result(score1, score2)
                    else: 
                        result_france = get_result(score2, score1)


                competition = match_data[5].text.strip()

                location = re.sub(r'\[[^\]]*\]', '', match_data[2].text.strip())
                pattern_ok = re.match(pattern_location, location)
                ville = pattern_ok.group('city')
                stade = pattern_ok.group('stadium')
                pays = pattern_ok.group('country').replace(')', '').strip()

            except AttributeError as e:
                print(e)
                print([d.text.strip() for d in match_data])

            row = [date, pays, ville, stade, equipe1, equipe2, score1, score2, result_france, competition]
            for i in range(1, len(row)):
                if row[i] and type(row[i])==str:
                    row[i] = re.sub(pattern_reference, '', row[i])
                    row[i] = row[i].replace('\n', ' ')
            dataset.append(row)

matches_df = pd.DataFrame(
    dataset, 
    columns = ["date", "pays", "ville", "stade", "equipe1", "equipe2", "score1", "score2", "result_france", "competition"]
)

matches_df.to_csv('matchs_france.csv')