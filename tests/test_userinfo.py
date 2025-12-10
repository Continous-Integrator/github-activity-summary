import json
import responses
import requests


def get_github_user_with_avatar(username):
    user_response = requests.get(f"https://api.github.com/users/{username}")
    user_response.raise_for_status()
    user_data = user_response.json()

    avatar_response = requests.get(user_data["avatar_url"])
    avatar_response.raise_for_status()
    
    return {
        "user_data": user_data,
        "gravatar": avatar_response.content
    }


@responses.activate
def test_github_user_with_avatar():
    with open("tests/get_github_user.json", "r") as user_data_response:
        mock_user_data = json.load(user_data_response)
    responses.add(
        responses.GET,
        "https://api.github.com/users/Continous-Integrator",
        json=mock_user_data,
        status=200,
    )
    
    with open("tests/ref_gravatar.png", "rb") as user_gravatar:
        mock_user_gravatar = user_gravatar.read()
    responses.add(
        responses.GET,
        "https://avatars.githubusercontent.com/u/153292231?v=4",
        body=mock_user_gravatar,
        status=200,
    )

    result = get_github_user_with_avatar("Continous-Integrator")    
    assert result["user_data"]["login"] == "Continous-Integrator"
    assert result["user_data"]["id"] == 153292231
    assert result["gravatar"] == mock_user_gravatar
    assert len(responses.calls) == 2
